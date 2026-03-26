import { join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolveMcpPath } from '../shared/mcp-path.js';

export { resolveMcpPath };

/** Resolve absolute path to bun binary */
function resolveBunPath(): string {
  try {
    return execSync('which bun', { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return 'bun';
  }
}

export function getRegistryPaths(): string[] {
  return [
    join(homedir(), '.omx', 'mcp-registry.json'),
    join(homedir(), '.omc', 'mcp-registry.json'),
  ];
}

export function ensureMcpRegistered(sdkLog?: typeof console.log): boolean {
  const registryPaths = getRegistryPaths();
  let targetPath = registryPaths[0];

  for (const p of registryPaths) {
    if (existsSync(p)) {
      targetPath = p;
      break;
    }
  }

  let registry: Record<
    string,
    { command?: string; args?: string[]; enabled?: boolean } | undefined
  > = {};

  if (existsSync(targetPath)) {
    try {
      const content = readFileSync(targetPath, 'utf-8');
      registry = JSON.parse(content);
    } catch (e) {
      if (sdkLog) {
        sdkLog(
          `[ERROR] Failed to parse MCP registry at ${targetPath}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      registry = {};
    }
  }

  const mcpPath = resolveMcpPath();
  const bunPath = resolveBunPath();
  const expectedConfig = {
    command: bunPath,
    args: [mcpPath],
    enabled: true,
  };

  // Use consistent name: context-mcp (hyphen)
  const currentConfig = registry['context-mcp'];
  let changed = false;

  // Clean up legacy underscore name
  if ('context_mcp' in registry) {
    delete registry['context_mcp'];
    changed = true;
  }

  if (
    !currentConfig ||
    currentConfig.command !== expectedConfig.command ||
    !Array.isArray(currentConfig.args) ||
    currentConfig.args[0] !== expectedConfig.args[0] ||
    currentConfig.enabled !== true
  ) {
    registry['context-mcp'] = expectedConfig;
    changed = true;
  }

  if (changed) {
    try {
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, JSON.stringify(registry, null, 2), 'utf-8');
      if (sdkLog) {
        sdkLog(`[INFO] Registered context-mcp in ${targetPath}`);
      }
      return true;
    } catch (e) {
      if (sdkLog) {
        sdkLog(
          `[ERROR] Failed to write MCP registry to ${targetPath}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      return false;
    }
  }

  return false;
}
