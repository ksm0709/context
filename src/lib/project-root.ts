import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

/**
 * Walk up from `startDir` looking for a `.git` directory or file.
 * Returns the directory that contains `.git`, or `null` if none found.
 */
export function findGitRoot(startDir: string): string | null {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, '.git'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }
    current = parent;
  }
}

export interface ProjectPaths {
  /** Directory where `.context/` is created (git root or home dir) */
  contextParent: string;
  /** Full path to AGENTS.md */
  agentsMdPath: string;
  /** Full path to CLAUDE.md */
  claudeMdPath: string;
}

/**
 * Resolve project paths for `.context`, `AGENTS.md`, and `CLAUDE.md`.
 *
 * - Git repo: `.context/` + `AGENTS.md` + `CLAUDE.md` at repo root
 * - No git repo: `~/.context/` with `AGENTS.md` + `CLAUDE.md` inside it
 */
export function resolveProjectPaths(startDir: string): ProjectPaths {
  const gitRoot = findGitRoot(startDir);
  if (gitRoot) {
    return {
      contextParent: gitRoot,
      agentsMdPath: join(gitRoot, 'AGENTS.md'),
      claudeMdPath: join(gitRoot, 'CLAUDE.md'),
    };
  }
  const home = homedir();
  const contextDir = join(home, '.context');
  return {
    contextParent: home,
    agentsMdPath: join(contextDir, 'AGENTS.md'),
    claudeMdPath: join(contextDir, 'CLAUDE.md'),
  };
}
