import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installOmx, installOmc } from './install.js';

vi.mock('../../shared/claude-settings.js', () => ({
  normalizeContextMcpServer: vi.fn(),
  removeMcpServer: vi.fn(),
  registerHook: vi.fn(),
}));

vi.mock('../../lib/scaffold.js', () => ({
  scaffoldIfNeeded: vi.fn(),
}));

vi.mock('../../shared/agents-md.js', () => ({
  injectIntoAgentsMd: vi.fn(),
}));

vi.mock('../../shared/mcp-path.js', () => ({
  resolveMcpPath: vi.fn(() => '/mock/dist/mcp.js'),
}));

vi.mock('../../omx/registry.js', () => ({
  ensureMcpRegistered: vi.fn().mockReturnValue(false),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => '/usr/local/bin/bun'),
}));

import {
  normalizeContextMcpServer,
  removeMcpServer,
  registerHook,
} from '../../shared/claude-settings.js';
import { execSync } from 'node:child_process';
import { scaffoldIfNeeded } from '../../lib/scaffold.js';
import { injectIntoAgentsMd } from '../../shared/agents-md.js';

describe('installOmx', () => {
  let tmpDir: string;
  let sourceFile: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    tmpDir = join(tmpdir(), `install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });

    const sourceDir = join(tmpDir, 'source');
    mkdirSync(sourceDir, { recursive: true });
    sourceFile = join(sourceDir, 'index.mjs');
    writeFileSync(sourceFile, 'export default function hook() {}');

    stdout = [];
    stderr = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      stdout.push(String(s));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      stderr.push(String(s));
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('copies source to .omx/hooks/context.mjs', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installOmx(projectDir, sourceFile);

    const target = join(projectDir, '.omx', 'hooks', 'context.mjs');
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf-8')).toBe('export default function hook() {}');
    expect(stdout.join('')).toContain('Installed context plugin to .omx/hooks/context.mjs');
  });

  it('auto-creates .omx/hooks/ when directory does not exist', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    expect(existsSync(join(projectDir, '.omx', 'hooks'))).toBe(false);

    installOmx(projectDir, sourceFile);

    expect(existsSync(join(projectDir, '.omx', 'hooks'))).toBe(true);
    expect(existsSync(join(projectDir, '.omx', 'hooks', 'context.mjs'))).toBe(true);
  });

  it('overwrites existing file when already installed', () => {
    const projectDir = join(tmpDir, 'project');
    const hooksDir = join(projectDir, '.omx', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'context.mjs'), 'old version');

    installOmx(projectDir, sourceFile);

    expect(readFileSync(join(hooksDir, 'context.mjs'), 'utf-8')).toBe(
      'export default function hook() {}'
    );
    expect(stdout.join('')).toContain('Installed context plugin to .omx/hooks/context.mjs');
  });

  it('exits with error when source file not found', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installOmx(projectDir, '/nonexistent/path/source.mjs');

    expect(stderr.join('')).toContain('Could not find OMX plugin source');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(existsSync(join(projectDir, '.omx', 'hooks', 'context.mjs'))).toBe(false);
  });
});

describe('installOmc', () => {
  let tmpDir: string;
  let stdout: string[];

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `install-omc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tmpDir, { recursive: true });

    stdout = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      stdout.push(String(s));
      return true;
    });

    (scaffoldIfNeeded as ReturnType<typeof vi.fn>).mockClear();
    (injectIntoAgentsMd as ReturnType<typeof vi.fn>).mockClear();
    (normalizeContextMcpServer as ReturnType<typeof vi.fn>).mockClear();
    (removeMcpServer as ReturnType<typeof vi.fn>).mockClear();
    (registerHook as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('scaffolds project and injects into AGENTS.md', () => {
    installOmc(tmpDir);

    expect(scaffoldIfNeeded).toHaveBeenCalledWith(tmpDir);
    expect(injectIntoAgentsMd).toHaveBeenCalledWith(join(tmpDir, 'AGENTS.md'), expect.any(String));
  });

  it('removes old MCP entries and registers via claude mcp add', () => {
    installOmc(tmpDir);

    expect(normalizeContextMcpServer).toHaveBeenCalled();
    expect(removeMcpServer).toHaveBeenCalledWith('context_mcp');
    expect(removeMcpServer).toHaveBeenCalledWith('context-mcp');

    const calls = (execSync as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) =>
      String(c[0])
    );
    expect(calls).toContain('claude mcp remove -s user context-mcp');
    expect(calls.find((c) => c.includes('claude mcp add -s user context-mcp'))).toBeTruthy();
  });

  it('registers SessionStart and Stop hooks', () => {
    installOmc(tmpDir);

    expect(registerHook).toHaveBeenCalledWith(
      'SessionStart',
      expect.objectContaining({
        matcher: 'startup',
        hooks: expect.arrayContaining([
          expect.objectContaining({
            type: 'command',
            command: expect.stringContaining('session-start-hook.js'),
            timeout: 15,
          }),
        ]),
      })
    );

    expect(registerHook).toHaveBeenCalledWith(
      'Stop',
      expect.objectContaining({
        hooks: expect.arrayContaining([
          expect.objectContaining({
            type: 'command',
            command: expect.stringContaining('stop-hook.js'),
            timeout: 10,
          }),
        ]),
      })
    );
  });

  it('prints success message', () => {
    installOmc(tmpDir);

    expect(stdout.join('')).toContain('Successfully installed context (omc) plugin.');
  });
});
