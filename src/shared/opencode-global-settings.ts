import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser';

export interface OpenCodeMcpEntry {
  type: 'local' | 'remote';
  command?: string[];
  [key: string]: unknown;
}

export interface OpenCodeGlobalConfig {
  plugin?: string[];
  mcp?: Record<string, OpenCodeMcpEntry>;
  [key: string]: unknown;
}

export function getOpenCodeGlobalConfigPath(): string {
  return join(homedir(), '.config', 'opencode', 'opencode.json');
}

export function readOpenCodeGlobalConfig(): OpenCodeGlobalConfig {
  const configPath = getOpenCodeGlobalConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  const content = readFileSync(configPath, 'utf8');
  return parseJsonc(content) ?? {};
}

function writeOpenCodeGlobalConfig(updates: Record<string, unknown>): void {
  const configPath = getOpenCodeGlobalConfigPath();
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });

  let content: string;
  if (existsSync(configPath)) {
    content = readFileSync(configPath, 'utf8');
    for (const [key, value] of Object.entries(updates)) {
      const edits = modify(content, [key], value, {});
      content = applyEdits(content, edits);
    }
  } else {
    content = JSON.stringify(updates, null, 2);
  }

  const tmp = configPath + '.tmp';
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, configPath);
}

export function registerOpenCodeMcp(command: string[]): void {
  const config = readOpenCodeGlobalConfig();
  const mcp = config.mcp ?? {};
  mcp['context-mcp'] = { type: 'local', command };
  writeOpenCodeGlobalConfig({ ...config, mcp });
}

export function removeOpenCodePlugin(pluginName: string): void {
  const config = readOpenCodeGlobalConfig();
  if (!Array.isArray(config.plugin)) return;
  const filtered = config.plugin.filter((p) => p !== pluginName);
  if (filtered.length === config.plugin.length) return;
  writeOpenCodeGlobalConfig({ ...config, plugin: filtered });
}
