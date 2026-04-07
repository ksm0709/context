import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolveWorkspacePackageRoot } from './package-root.js';

export function resolveMcpPath(): string {
  // Priority 1: active workspace package (supports git worktree / local dev builds)
  const workspaceRoot = resolveWorkspacePackageRoot();
  if (workspaceRoot) {
    const workspaceDist = join(workspaceRoot, 'dist', 'mcp.js');
    if (existsSync(workspaceDist)) return workspaceDist;
    const workspaceSrc = join(workspaceRoot, 'src', 'mcp.ts');
    if (existsSync(workspaceSrc)) return workspaceSrc;
  }

  // Priority 2: npm package resolution (stable in installed environments)
  try {
    const req = createRequire(import.meta.url);
    const pkgJsonPath = req.resolve('@ksm0709/context/package.json');
    const pkgRoot = dirname(pkgJsonPath);
    const distMcp = join(pkgRoot, 'dist', 'mcp.js');
    if (existsSync(distMcp)) return distMcp;
  } catch {
    /* package not installed — dev environment */
  }

  // Priority 3: relative path (module-local dev environment)
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const distMcpPath = resolve(currentDir, '..', 'mcp.js');
  if (existsSync(distMcpPath)) return distMcpPath;
  const srcMcpPath = resolve(currentDir, '..', 'mcp.ts');
  if (existsSync(srcMcpPath)) return srcMcpPath;
  return distMcpPath;
}
