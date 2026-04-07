import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const PACKAGE_NAME = '@ksm0709/context';

function readPackageName(packageJsonPath: string): string | null {
  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { name?: string };
    return typeof parsed.name === 'string' ? parsed.name : null;
  } catch {
    return null;
  }
}

export function resolveWorkspacePackageRoot(startDir: string = process.cwd()): string | null {
  let current = resolve(startDir);

  while (true) {
    const packageJsonPath = join(current, 'package.json');
    if (existsSync(packageJsonPath) && readPackageName(packageJsonPath) === PACKAGE_NAME) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
