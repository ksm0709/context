import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function resolveContextDir(projectDir: string): string {
  const nextContextDir = '.context';

  if (existsSync(join(projectDir, nextContextDir))) {
    return nextContextDir;
  }

  const legacyContextDir = '.opencode/context';

  if (existsSync(join(projectDir, legacyContextDir))) {
    return legacyContextDir;
  }

  return nextContextDir;
}
