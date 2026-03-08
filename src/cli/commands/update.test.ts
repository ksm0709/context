import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { detectPackageManager } from './update.js';

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
