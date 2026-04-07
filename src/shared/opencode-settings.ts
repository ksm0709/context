import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser';

const CONTEXT_PLUGIN_NAME = '@ksm0709/context';

export interface OpenCodeConfig {
  plugin?: string[];
  [key: string]: unknown;
}

export function getOpenCodeConfigPath(projectDir: string): string {
  return join(projectDir, 'opencode.json');
}

export function readOpenCodeConfig(projectDir: string): OpenCodeConfig {
  const configPath = getOpenCodeConfigPath(projectDir);
  if (!existsSync(configPath)) {
    return {};
  }

  const content = readFileSync(configPath, 'utf8');
  return parseJsonc(content) ?? {};
}

export function writeOpenCodeConfig(projectDir: string, config: OpenCodeConfig): void {
  const configPath = getOpenCodeConfigPath(projectDir);
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let content: string;
  if (existsSync(configPath)) {
    content = readFileSync(configPath, 'utf8');
    for (const [key, value] of Object.entries(config)) {
      const edits = modify(content, [key], value, {});
      content = applyEdits(content, edits);
    }

    const existing = parseJsonc(content) ?? {};
    for (const key of Object.keys(existing)) {
      if (!(key in config)) {
        const edits = modify(content, [key], undefined, {});
        content = applyEdits(content, edits);
      }
    }
  } else {
    content = JSON.stringify(config, null, 2);
  }

  const tmp = configPath + '.tmp';
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, configPath);
}

export function ensureContextPluginRegistered(projectDir: string): boolean {
  const config = readOpenCodeConfig(projectDir);
  const plugins = Array.isArray(config.plugin) ? config.plugin : [];

  if (plugins.includes(CONTEXT_PLUGIN_NAME)) {
    return false;
  }

  writeOpenCodeConfig(projectDir, {
    ...config,
    plugin: [...plugins, CONTEXT_PLUGIN_NAME],
  });
  return true;
}
