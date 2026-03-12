import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { detectPackageManager, isGloballyInstalled, runUpdatePlugin } from './update.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('detectPackageManager', () => {
  it('returns bun when bun.lock exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'bun.lock');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns bun when bun.lockb exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'bun.lockb');
    expect(detectPackageManager()).toBe('bun');
  });

  it('returns pnpm when pnpm-lock.yaml exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'pnpm-lock.yaml');
    expect(detectPackageManager()).toBe('pnpm');
  });

  it('returns yarn when yarn.lock exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'yarn.lock');
    expect(detectPackageManager()).toBe('yarn');
  });

  it('returns npm when package-lock.json exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((path) => String(path) === 'package-lock.json');
    expect(detectPackageManager()).toBe('npm');
  });

  it('defaults to bun when no lock file found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(detectPackageManager()).toBe('bun');
  });
});

describe('isGloballyInstalled', () => {
  it('returns true when ~/.bun/bin/context exists', () => {
    const home = process.env.HOME ?? '/home/user';
    vi.mocked(fs.existsSync).mockImplementation(
      (path) => String(path) === `${home}/.bun/bin/context`
    );
    expect(isGloballyInstalled()).toBe(true);
  });

  it('returns false when ~/.bun/bin/context does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(isGloballyInstalled()).toBe(false);
  });
});

describe('runUpdatePlugin', () => {
  let originalSpawnSync: any;

  const stdout: string[] = [];
  const stderr: string[] = [];

  beforeEach(() => {
    (globalThis as any).Bun = { spawnSync: vi.fn() };
    stdout.length = 0;
    stderr.length = 0;
    originalSpawnSync = (globalThis as any).Bun.spawnSync;
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
    (globalThis as any).Bun.spawnSync = originalSpawnSync;
    vi.restoreAllMocks();
  });
});
