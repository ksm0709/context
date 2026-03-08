import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { detectPackageManager, isGloballyInstalled, runUpdatePlugin } from './update.js';

describe('detectPackageManager', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    if (existsSyncSpy) {
      existsSyncSpy.mockRestore();
    }
  });

  it('returns bun when bun.lock exists', () => {
    existsSyncSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => String(path) === 'bun.lock');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns bun when bun.lockb exists', () => {
    existsSyncSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => String(path) === 'bun.lockb');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns pnpm when pnpm-lock.yaml exists', () => {
    existsSyncSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => String(path) === 'pnpm-lock.yaml');
    expect(detectPackageManager()).toBe('pnpm');
  });

  it('returns yarn when yarn.lock exists', () => {
    existsSyncSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => String(path) === 'yarn.lock');
    expect(detectPackageManager()).toBe('yarn');
  });

  it('returns npm when package-lock.json exists', () => {
    existsSyncSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => String(path) === 'package-lock.json');
    expect(detectPackageManager()).toBe('npm');
  });

  it('defaults to bun when no lock file found', () => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(detectPackageManager()).toBe('bun');
  });
});

describe('isGloballyInstalled', () => {
  let existsSyncSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    if (existsSyncSpy) {
      existsSyncSpy.mockRestore();
    }
  });

  it('returns true when ~/.bun/bin/context exists', () => {
    const home = process.env.HOME ?? '/home/user';
    existsSyncSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((path) => String(path) === `${home}/.bun/bin/context`);
    expect(isGloballyInstalled()).toBe(true);
  });

  it('returns false when ~/.bun/bin/context does not exist', () => {
    existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(isGloballyInstalled()).toBe(false);
  });
});

describe('runUpdatePlugin', () => {
  let originalSpawnSync: typeof Bun.spawnSync;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const stdout: string[] = [];
  const stderr: string[] = [];

  beforeEach(() => {
    stdout.length = 0;
    stderr.length = 0;
    originalSpawnSync = Bun.spawnSync;
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      stdout.push(String(s));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      stderr.push(String(s));
      return true;
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    Bun.spawnSync = originalSpawnSync;
    vi.restoreAllMocks();
  });

  it('updates global first when globally installed, then local', () => {
    // Global exists, local lockfile = bun.lock
    vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
      const p = String(path);
      const home = process.env.HOME ?? '/home/user';
      return p === `${home}/.bun/bin/context` || p === 'bun.lock';
    });

    const calls: string[][] = [];
    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockImplementation((cmd: string[]) => {
      calls.push([...cmd]);
      return { exitCode: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
    });

    runUpdatePlugin('1.0.0');

    // Global update should be called first
    expect(calls[0]).toEqual(['bun', 'install', '-g', '@ksm0709/context@1.0.0']);
    // Local update should be called second
    expect(calls[1]).toEqual(['bun', 'add', '@ksm0709/context@1.0.0']);
    expect(stdout.join('')).toContain('global');
    expect(stdout.join('')).toContain('local');
  });

  it('updates only local when not globally installed', () => {
    // No global, lockfile = bun.lock
    vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
      return String(path) === 'bun.lock';
    });

    const calls: string[][] = [];
    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockImplementation((cmd: string[]) => {
      calls.push([...cmd]);
      return { exitCode: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
    });

    runUpdatePlugin('2.0.0');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(['bun', 'add', '@ksm0709/context@2.0.0']);
  });

  it('exits 1 when global update fails', () => {
    const home = process.env.HOME ?? '/home/user';
    vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
      return String(path) === `${home}/.bun/bin/context`;
    });

    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockReturnValue({
      exitCode: 1,
      stdout: Buffer.from(''),
      stderr: Buffer.from('global install error'),
    });

    runUpdatePlugin('1.0.0');

    expect(stderr.join('')).toContain('Failed to update global');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when local update fails after global succeeds', () => {
    const home = process.env.HOME ?? '/home/user';
    vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
      const p = String(path);
      return p === `${home}/.bun/bin/context` || p === 'bun.lock';
    });

    let callCount = 0;
    // @ts-expect-error — mocking Bun.spawnSync for test
    Bun.spawnSync = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { exitCode: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
      }
      return { exitCode: 1, stdout: Buffer.from(''), stderr: Buffer.from('local error') };
    });

    runUpdatePlugin('1.0.0');

    expect(stderr.join('')).toContain('Failed to update local');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
