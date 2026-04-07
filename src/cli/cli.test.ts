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
  installClaude: vi.fn(),
  installCodex: vi.fn(),
  resolveCodexHookSource: vi.fn().mockReturnValue('/mock/dist/codex/stop-hook.js'),
  resolveOmxSource: vi.fn().mockReturnValue('/mock/dist/omx/index.mjs'),
}));
import { isRemoteVersionNewer, printHelp, printUpdateNoticeIfAvailable, runCli } from './index.js';
import { getSettingsPath, setSettingsPath } from '../shared/claude-settings.js';

describe('printHelp', () => {
  it('prints usage and all subcommands', () => {
    const lines: string[] = [];
    printHelp((s) => lines.push(s));
    const output = lines.join('');

    expect(output).toContain('Usage: context <command>');
    expect(output).toContain('update [path]');
    expect(output).toContain('Claude/Codex/OpenCode integrations');
    expect(output).toContain('update claude [path]');
    expect(output).toContain('update codex [path]');
    expect(output).toContain('update plugin [version]');
    expect(output).toContain('update migrate [path]');
    expect(output).not.toContain('install omc');
    expect(output).not.toContain('migrate [path] [--keep]');
  });
});

describe('version checks', () => {
  it('detects when the remote version is newer', () => {
    expect(isRemoteVersionNewer('1.14.0', '1.15.0')).toBe(true);
    expect(isRemoteVersionNewer('1.14.0', '1.14.1')).toBe(true);
  });

  it('does not report older or equal versions as newer', () => {
    expect(isRemoteVersionNewer('1.14.0', '1.14.0')).toBe(false);
    expect(isRemoteVersionNewer('1.14.0', '1.13.9')).toBe(false);
    expect(isRemoteVersionNewer('1.14.0', 'invalid')).toBe(false);
  });

  it('prints an update notice when npm reports a newer published version', () => {
    const out: string[] = [];
    vi.mocked(
      (globalThis as { Bun?: { spawnSync: typeof Bun.spawnSync } }).Bun!.spawnSync
    ).mockReturnValueOnce({
      exitCode: 0,
      stdout: Buffer.from('9.9.9\n'),
      stderr: Buffer.from(''),
    } as never);

    printUpdateNoticeIfAvailable((s) => out.push(s));

    expect(out.join('')).toContain('Update available');
    expect(out.join('')).toContain('context update plugin');
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
    vi.mocked(
      (globalThis as { Bun?: { spawnSync: typeof Bun.spawnSync } }).Bun!.spawnSync
    ).mockImplementation((_cmd: string[]) => {
      return { exitCode: 1, stdout: Buffer.from(''), stderr: Buffer.from('') } as never;
    });
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

  it('migrate top-level command routes through update migrate', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['migrate', tmpDir]);
    expect(out.join('')).toContain('Nothing to migrate');
  });

  it('install codex alias routes through update codex', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['install', 'omx', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)|up to date/);
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
