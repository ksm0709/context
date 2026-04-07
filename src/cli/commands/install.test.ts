import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installCodex, installOmc, resolveCodexHookSource } from './install.js';

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

vi.mock('../../shared/codex-hooks.js', () => ({
  registerCodexHook: vi.fn(),
  getCodexHooksDir: vi.fn(() => {
    const { tmpdir } = require('node:os');
    return require('node:path').join(tmpdir(), '.codex', 'hooks');
  }),
}));

vi.mock('../../shared/mcp-path.js', () => ({
  resolveMcpPath: vi.fn(() => '/mock/dist/mcp.js'),
}));

vi.mock('../../shared/codex-settings.js', () => ({
  ensureContextMcpRegistered: vi.fn().mockReturnValue(false),
  pruneStaleMockMcpServer: vi.fn().mockReturnValue(false),
}));

vi.mock('../../omx/registry.js', () => ({
  ensureMcpRegistered: vi.fn().mockReturnValue(false),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => '/usr/local/bin/bun'),
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: vi.fn(() => actual.tmpdir()),
  };
});

import {
  normalizeContextMcpServer,
  removeMcpServer,
  registerHook,
} from '../../shared/claude-settings.js';
import {
  ensureContextMcpRegistered,
  pruneStaleMockMcpServer,
} from '../../shared/codex-settings.js';
import { execSync } from 'node:child_process';
import { scaffoldIfNeeded } from '../../lib/scaffold.js';
import { injectIntoAgentsMd } from '../../shared/agents-md.js';
import { registerCodexHook } from '../../shared/codex-hooks.js';

describe('installCodex', () => {
  let tmpDir: string;
  let stopSourceFile: string;
  let sessionStartSourceFile: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    tmpDir = join(tmpdir(), `install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });

    const sourceDir = join(tmpDir, 'source');
    mkdirSync(sourceDir, { recursive: true });
    stopSourceFile = join(sourceDir, 'stop-hook.js');
    sessionStartSourceFile = join(sourceDir, 'session-start-hook.js');
    writeFileSync(stopSourceFile, 'console.log("stop");');
    writeFileSync(sessionStartSourceFile, 'console.log("start");');

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

  it('copies hook sources to ~/.codex/hooks/', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installCodex(projectDir, sessionStartSourceFile, stopSourceFile);

    const globalHooksDir = join(tmpdir(), '.codex', 'hooks');
    expect(existsSync(join(globalHooksDir, 'context-session-start-hook.js'))).toBe(true);
    expect(existsSync(join(globalHooksDir, 'context-stop-hook.js'))).toBe(true);
    expect(stdout.join('')).toContain(
      'Installed context hooks to ~/.codex/hooks/ and ~/.codex/hooks.json'
    );
  });

  it('auto-creates ~/.codex/hooks/ when directory does not exist', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    const globalHooksDir = join(tmpdir(), '.codex', 'hooks');
    installCodex(projectDir, sessionStartSourceFile, stopSourceFile);

    expect(existsSync(globalHooksDir)).toBe(true);
  });

  it('registers SessionStart and Stop hooks in ~/.codex/hooks.json', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installCodex(projectDir, sessionStartSourceFile, stopSourceFile);

    expect(registerCodexHook).toHaveBeenCalledWith(
      'SessionStart',
      expect.objectContaining({ matcher: 'startup|resume' })
    );
    expect(registerCodexHook).toHaveBeenCalledWith(
      'Stop',
      expect.objectContaining({ hooks: expect.any(Array) })
    );
  });

  it('registers context-mcp in ~/.codex/config.toml', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    vi.mocked(ensureContextMcpRegistered).mockReturnValue(true);
    installCodex(projectDir, sessionStartSourceFile, stopSourceFile);

    expect(ensureContextMcpRegistered).toHaveBeenCalledTimes(1);
    expect(stdout.join('')).toContain(
      'Successfully registered context-mcp in ~/.codex/config.toml'
    );
  });

  it('removes stale mock-mcp from Codex config when present', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });
    vi.mocked(pruneStaleMockMcpServer).mockReturnValue(true);

    installCodex(projectDir, sessionStartSourceFile, stopSourceFile);

    expect(pruneStaleMockMcpServer).toHaveBeenCalledTimes(1);
    expect(stdout.join('')).toContain('Removed stale mock-mcp from ~/.codex/config.toml');
  });

  it('exits with error when source file not found', () => {
    const projectDir = join(tmpDir, 'project');
    mkdirSync(projectDir, { recursive: true });

    installCodex(projectDir, '/nonexistent/path/start.js', '/nonexistent/path/stop.js');

    expect(stderr.join('')).toContain('Could not find Codex hook source files');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(existsSync(join(projectDir, '.codex', 'hooks', 'context-stop-hook.js'))).toBe(false);
  });
});

describe('resolveCodexHookSource', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `resolve-codex-hook-source-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(join(tmpDir, 'dist', 'codex'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: '@ksm0709/context', version: '9.9.9' }),
      'utf8'
    );
    writeFileSync(join(tmpDir, 'dist', 'codex', 'stop-hook.js'), 'console.log("workspace");');
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prefers workspace dist files over the globally installed package', () => {
    expect(resolveCodexHookSource('stop-hook.js')).toBe(
      join(tmpDir, 'dist', 'codex', 'stop-hook.js')
    );
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
