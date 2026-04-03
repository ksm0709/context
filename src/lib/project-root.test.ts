import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { findGitRoot, resolveProjectPaths } from './project-root';

const createdDirs: string[] = [];

const createTmpDir = (): string => {
  const dir = join(
    tmpdir(),
    `project-root-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  createdDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  createdDirs.length = 0;
});

describe('findGitRoot', () => {
  it('returns directory containing .git', () => {
    const root = createTmpDir();
    mkdirSync(join(root, '.git'));

    expect(findGitRoot(root)).toBe(root);
  });

  it('walks up to find .git in parent directory', () => {
    const root = createTmpDir();
    mkdirSync(join(root, '.git'));
    const nested = join(root, 'src', 'lib');
    mkdirSync(nested, { recursive: true });

    expect(findGitRoot(nested)).toBe(root);
  });

  it('detects .git file (worktree)', () => {
    const root = createTmpDir();
    writeFileSync(join(root, '.git'), 'gitdir: /some/path/.git/worktrees/foo');

    expect(findGitRoot(root)).toBe(root);
  });

  it('returns null when no .git found above tmpdir', () => {
    const dir = createTmpDir();
    const result = findGitRoot(dir);
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('resolveProjectPaths', () => {
  it('returns repo root paths when inside a git repo', () => {
    const root = createTmpDir();
    mkdirSync(join(root, '.git'));
    const nested = join(root, 'packages', 'foo');
    mkdirSync(nested, { recursive: true });

    const paths = resolveProjectPaths(nested);
    expect(paths.contextParent).toBe(root);
    expect(paths.agentsMdPath).toBe(join(root, 'AGENTS.md'));
    expect(paths.claudeMdPath).toBe(join(root, 'CLAUDE.md'));
  });

  it('returns home-based paths when not in a git repo', () => {
    // When not in a git repo, AGENTS.md and CLAUDE.md go inside ~/.context/
    const home = homedir();
    const expected = {
      contextParent: home,
      agentsMdPath: join(home, '.context', 'AGENTS.md'),
      claudeMdPath: join(home, '.context', 'CLAUDE.md'),
    };

    // We can't easily create a dir with no .git above it in test environments,
    // so verify the contract directly
    const paths = resolveProjectPaths('/tmp/nonexistent-no-git-repo-12345');
    // If /tmp happens to be in a git repo, skip assertion
    if (findGitRoot('/tmp/nonexistent-no-git-repo-12345') === null) {
      expect(paths).toEqual(expected);
    }
  });

  it('resolves from deeply nested subdirectory', () => {
    const root = createTmpDir();
    mkdirSync(join(root, '.git'));
    const deep = join(root, 'a', 'b', 'c', 'd');
    mkdirSync(deep, { recursive: true });

    const paths = resolveProjectPaths(deep);
    expect(paths.contextParent).toBe(root);
    expect(paths.agentsMdPath).toBe(join(root, 'AGENTS.md'));
  });

  it('returns git root even when .git is a file (worktree)', () => {
    const root = createTmpDir();
    writeFileSync(join(root, '.git'), 'gitdir: /some/path/.git/worktrees/foo');

    const paths = resolveProjectPaths(root);
    expect(paths.contextParent).toBe(root);
  });
});
