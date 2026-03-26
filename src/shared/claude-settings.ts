import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser';

export interface McpServerEntry {
  command: string;
  args: string[];
  enabled?: boolean;
}

export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number;
  statusMessage?: string;
}

export interface HookRule {
  matcher?: string;
  hooks: HookCommand[];
}

export interface ClaudeSettings {
  mcpServers?: Record<string, McpServerEntry>;
  hooks?: Record<string, HookRule[]>;
  [key: string]: unknown;
}

const CONTEXT_MCP_SERVER_NAME = 'context-mcp';
const LEGACY_CONTEXT_MCP_SERVER_NAME = 'context_mcp';

// Allow overriding settings path for testing
let settingsPath = join(homedir(), '.claude', 'settings.json');

export function getSettingsPath(): string {
  return settingsPath;
}

export function setSettingsPath(path: string): void {
  settingsPath = path;
}

export function readClaudeSettings(): ClaudeSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }
  const content = readFileSync(settingsPath, 'utf8');
  return parseJsonc(content) ?? {};
}

export function hasContextMcpServer(settings: ClaudeSettings): boolean {
  if (!settings.mcpServers) {
    return false;
  }

  return (
    CONTEXT_MCP_SERVER_NAME in settings.mcpServers ||
    LEGACY_CONTEXT_MCP_SERVER_NAME in settings.mcpServers
  );
}

export function writeClaudeSettings(settings: ClaudeSettings): void {
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let content: string;
  if (existsSync(settingsPath)) {
    // Preserve JSONC comments by using modify + applyEdits
    content = readFileSync(settingsPath, 'utf8');
    for (const [key, value] of Object.entries(settings)) {
      const edits = modify(content, [key], value, {});
      content = applyEdits(content, edits);
    }
    // Remove keys not in settings
    const existing = parseJsonc(content) ?? {};
    for (const key of Object.keys(existing)) {
      if (!(key in settings)) {
        const edits = modify(content, [key], undefined, {});
        content = applyEdits(content, edits);
      }
    }
  } else {
    content = JSON.stringify(settings, null, 2);
  }

  const tmp = settingsPath + '.tmp';
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, settingsPath);
}

export function registerMcpServer(name: string, entry: McpServerEntry): void {
  const settings = readClaudeSettings();
  if (!settings.mcpServers) {
    settings.mcpServers = {};
  }
  settings.mcpServers[name] = entry;
  writeClaudeSettings(settings);
}

export function removeMcpServer(name: string): void {
  const settings = readClaudeSettings();
  if (settings.mcpServers) {
    delete settings.mcpServers[name];
    writeClaudeSettings(settings);
  }
}

export function normalizeContextMcpServer(): boolean {
  const settings = readClaudeSettings();
  if (!settings.mcpServers) {
    return false;
  }

  const currentEntry = settings.mcpServers[CONTEXT_MCP_SERVER_NAME];
  const legacyEntry = settings.mcpServers[LEGACY_CONTEXT_MCP_SERVER_NAME];
  if (!currentEntry && !legacyEntry) {
    return false;
  }

  const nextEntry = currentEntry ?? legacyEntry;
  let changed = false;

  if (legacyEntry) {
    delete settings.mcpServers[LEGACY_CONTEXT_MCP_SERVER_NAME];
    changed = true;
  }

  if (!currentEntry && nextEntry) {
    settings.mcpServers[CONTEXT_MCP_SERVER_NAME] = nextEntry;
    changed = true;
  }

  if (changed) {
    writeClaudeSettings(settings);
  }

  return changed;
}

export function registerHook(event: string, rule: HookRule): void {
  const settings = readClaudeSettings();
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks[event]) {
    settings.hooks[event] = [];
  }

  const rules = settings.hooks[event];
  // Extract the commands from this rule
  for (const hookCmd of rule.hooks) {
    // Find if any existing rule contains this command
    let replaced = false;
    for (let i = 0; i < rules.length; i++) {
      const existingIdx = rules[i].hooks.findIndex((h) => h.command === hookCmd.command);
      if (existingIdx !== -1) {
        // Replace the entire rule that contains this command
        rules[i] = rule;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      rules.push(rule);
      break;
    }
  }

  writeClaudeSettings(settings);
}
