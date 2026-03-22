import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

export function resolveMcpPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);

  const distMcpPath = resolve(currentDir, '..', 'mcp.js');
  if (existsSync(distMcpPath)) {
    return distMcpPath;
  }

  const srcMcpPath = resolve(currentDir, '..', 'mcp.ts');
  if (existsSync(srcMcpPath)) {
    return srcMcpPath;
  }

  return distMcpPath;
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

  let registry: Record<string, { command?: string; args?: string[] } | undefined> = {};

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
  const expectedConfig = {
    command: 'bun',
    args: [mcpPath],
  };

  const currentConfig = registry['context-mcp'];

  if (
    !currentConfig ||
    currentConfig.command !== expectedConfig.command ||
    !Array.isArray(currentConfig.args) ||
    currentConfig.args[0] !== expectedConfig.args[0]
  ) {
    registry['context-mcp'] = expectedConfig;

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
