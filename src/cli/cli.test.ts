import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { printHelp, runCli } from './index.js';

describe('printHelp', () => {
  it('prints usage and all subcommands', () => {
    const lines: string[] = [];
    printHelp((s) => lines.push(s));
    const output = lines.join('');

    expect(output).toContain('Usage: context <command>');
    expect(output).toContain('update [all] [path]');
    expect(output).toContain('update prompt [path]');
    expect(output).toContain('update plugin [version]');
  });
});

describe('runCli', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `cli-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // --- update (default = all) ---
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

  // --- update all ---
  it('update all: same behavior as update without subcommand', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', 'all', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)/);
  });

  // --- update prompt ---
  it('update prompt: updates only prompt files', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', 'prompt', tmpDir]);
    const output = out.join('');
    expect(output).toMatch(/Updated \d+ prompt file\(s\)/);
    expect(output).toContain('turn-start.md');
    expect(output).toContain('turn-end.md');
  });

  it('update prompt: reports up-to-date when prompts already current', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    // First call creates them
    runCli(['update', 'prompt', tmpDir]);
    out.length = 0;

    // Second call should be up to date
    runCli(['update', 'prompt', tmpDir]);
    expect(out.join('')).toContain('up to date');
  });

  // --- update plugin ---
  it('update plugin: calls Bun.spawnSync with correct args', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    // Mock Bun.spawnSync
    const originalSpawnSync = Bun.spawnSync;
    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockReturnValue({
      exitCode: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
    });

    try {
      runCli(['update', 'plugin', '0.1.0']);
      const output = out.join('');
      expect(output).toContain('@ksm0709/context@0.1.0');
      expect(output).toContain('Successfully updated');
      expect(Bun.spawnSync).toHaveBeenCalledWith(
        expect.arrayContaining(['@ksm0709/context@0.1.0'])
      );
    } finally {
      Bun.spawnSync = originalSpawnSync;
    }
  });

  it('update plugin: defaults to latest when no version specified', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    const originalSpawnSync = Bun.spawnSync;
    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockReturnValue({
      exitCode: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
    });

    try {
      runCli(['update', 'plugin']);
      expect(out.join('')).toContain('@ksm0709/context@latest');
    } finally {
      Bun.spawnSync = originalSpawnSync;
    }
  });

  it('update plugin: exits 1 on failure', () => {
    const errOut: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      errOut.push(String(s));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    const originalSpawnSync = Bun.spawnSync;
    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockReturnValue({
      exitCode: 1,
      stdout: Buffer.from(''),
      stderr: Buffer.from('some error'),
    });

    try {
      runCli(['update', 'plugin', '0.1.0']);
      expect(errOut.join('')).toContain('Failed to update');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      Bun.spawnSync = originalSpawnSync;
    }
  });

  // --- backward compatibility ---
  it('update /path: backward compat — treats unknown subcommand as path', () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      out.push(String(s));
      return true;
    });

    runCli(['update', tmpDir]);
    expect(out.join('')).toMatch(/Updated \d+ file\(s\)|up to date/);
  });

  // --- help ---
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
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);

    runCli(['nonexistent']);
    expect(errOut.join('')).toContain('Unknown command: nonexistent');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
