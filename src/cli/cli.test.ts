// Mock Bun globally for tests
(globalThis as any).Bun = {
  spawnSync: vi.fn(),
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
vi.mock('./commands/install.js', () => ({
  installOmc: vi.fn(),
  installOmx: vi.fn(),
  installOpenCode: vi.fn(),
  resolveOmxSource: vi.fn().mockReturnValue('/mock/dist/omx/index.mjs'),
}));
import { printHelp, runCli } from './index.js';
import { getSettingsPath, setSettingsPath } from '../shared/claude-settings.js';

describe('printHelp', () => {
  it('prints usage and all subcommands', () => {
    const lines: string[] = [];
    printHelp((s) => lines.push(s));
    const output = lines.join('');

    expect(output).toContain('Usage: context <command>');
    expect(output).toContain('update [all] [path]');
    expect(output).toContain('Claude/Codex/OpenCode integrations');
    expect(output).toContain('update omx [path]');
    expect(output).toContain('update plugin [version]');
    expect(output).toContain('install omc');
  });
});

describe('runCli', () => {
  let tmpDir: string;
  let originalSettingsPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `cli-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    originalSettingsPath = getSettingsPath();
    setSettingsPath(join(tmpDir, '.claude', 'settings.json'));
  });

  afterEach(() => {
    setSettingsPath(originalSettingsPath);
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('update: reports up-to-date when scaffold already current', async () => {
    const { scaffoldIfNeeded } = await import('../lib/scaffold.js');
    scaffoldIfNeeded(tmpDir);

    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', tmpDir]);
    expect(out.join('')).toContain('up to date');
  });

  it('update: lists updated files when scaffold is stale', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)/);
  });

  it('update all: same behavior as update without subcommand', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', 'all', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)/);
  });

  it('update plugin: calls Bun.spawnSync with correct args', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    vi.mocked((globalThis as any).Bun.spawnSync).mockImplementation((_cmd: string[]) => {
      return { exitCode: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
    });

    runCli(['update', 'plugin', '0.1.0']);
    const output = out.join('');
    expect(output).toContain('@ksm0709/context@0.1.0');
    expect(output).toContain('Successfully updated');
    expect((globalThis as any).Bun.spawnSync).toHaveBeenCalledWith(
      expect.arrayContaining(['@ksm0709/context@0.1.0'])
    );
  });

  it('update plugin: defaults to latest when no version specified', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    vi.mocked((globalThis as any).Bun.spawnSync).mockImplementation((_cmd: string[]) => {
      return { exitCode: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
    });

    runCli(['update', 'plugin']);
    expect(out.join('')).toContain('@ksm0709/context@latest');
  });

  it('update plugin: exits 1 on failure', () => {
    const errOut: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      errOut.push(String(s));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    vi.mocked((globalThis as any).Bun.spawnSync).mockReturnValue({
      exitCode: 1,
      stdout: Buffer.from(''),
      stderr: Buffer.from('some error'),
    });

    runCli(['update', 'plugin', '0.1.0']);
    expect(errOut.join('')).toContain('Failed to update');
  });

  it('update /path: backward compat — treats unknown subcommand as path', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)|up to date/);
  });

  it('no args: prints help', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli([]);
    expect(out.join('')).toContain('Usage: context <command>');
  });

  it('--help: prints help', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['--help']);
    expect(out.join('')).toContain('Usage: context <command>');
  });

  it('-h: prints help', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['-h']);
    expect(out.join('')).toContain('Usage: context <command>');
  });

  it('unknown command: writes error to stderr and exits 1', () => {
    const errOut: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      errOut.push(String(s));
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    runCli(['nonexistent']);
    expect(errOut.join('')).toContain('Unknown command: nonexistent');
  });
});
