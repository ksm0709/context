import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveContextDir } from './context-dir';

const createdDirs: string[] = [];

const createProjectDir = (): string => {
  const projectDir = join(
    tmpdir(),
    `context-dir-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  mkdirSync(projectDir, { recursive: true });
  createdDirs.push(projectDir);
  return projectDir;
};

afterEach(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  createdDirs.length = 0;
});

describe('resolveContextDir', () => {
  it('returns .context when only .context exists', () => {
    const projectDir = createProjectDir();
    mkdirSync(join(projectDir, '.context'), { recursive: true });

    expect(resolveContextDir(projectDir)).toBe('.context');
  });

  it('returns .opencode/context when only legacy dir exists', () => {
    const projectDir = createProjectDir();
    mkdirSync(join(projectDir, '.opencode', 'context'), { recursive: true });

    expect(resolveContextDir(projectDir)).toBe('.opencode/context');
  });

  it('prefers .context when both directories exist', () => {
    const projectDir = createProjectDir();
    mkdirSync(join(projectDir, '.context'), { recursive: true });
    mkdirSync(join(projectDir, '.opencode', 'context'), { recursive: true });

    expect(resolveContextDir(projectDir)).toBe('.context');
  });

  it('returns .context when neither directory exists', () => {
    const projectDir = createProjectDir();

    expect(resolveContextDir(projectDir)).toBe('.context');
  });
});
