import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(): PackageJson {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(currentDir, '..', 'package.json');
  const packageJson = readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(packageJson) as PackageJson;
}

describe('package metadata', () => {
  it('does not depend on itself', () => {
    const packageJson = readPackageJson();

    expect(packageJson.dependencies?.[packageJson.name]).toBeUndefined();
    expect(packageJson.devDependencies?.[packageJson.name]).toBeUndefined();
  });
});
