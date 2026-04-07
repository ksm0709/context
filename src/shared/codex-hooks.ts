import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export interface CodexHookCommand {
  type: 'command';
  command: string;
  timeout?: number;
  statusMessage?: string;
}

export interface CodexHookRule {
  matcher?: string;
  hooks: CodexHookCommand[];
}

export interface CodexHooksConfig {
  hooks?: Record<string, CodexHookRule[]>;
}

export function getCodexHooksPath(): string {
  return join(homedir(), '.codex', 'hooks.json');
}

export function getCodexHooksDir(): string {
  return join(homedir(), '.codex', 'hooks');
}

export function readCodexHooks(): CodexHooksConfig {
  const hooksPath = getCodexHooksPath();
  if (!existsSync(hooksPath)) {
    return {};
  }

  return JSON.parse(readFileSync(hooksPath, 'utf8')) as CodexHooksConfig;
}

export function writeCodexHooks(config: CodexHooksConfig): void {
  const hooksPath = getCodexHooksPath();
  const dir = dirname(hooksPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmp = hooksPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', 'utf8');
  renameSync(tmp, hooksPath);
}

function scriptBasename(command: string): string {
  const parts = command.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? '';
  return last.split('/').pop() ?? last;
}

export function registerCodexHook(event: string, rule: CodexHookRule): void {
  const config = readCodexHooks();
  config.hooks ??= {};
  config.hooks[event] ??= [];

  const rules = config.hooks[event];
  for (const hookCmd of rule.hooks) {
    const basename = scriptBasename(hookCmd.command);
    const existingIndex = rules.findIndex((existingRule) =>
      existingRule.hooks.some((existingHook) => scriptBasename(existingHook.command) === basename)
    );

    if (existingIndex !== -1) {
      rules[existingIndex] = rule;
    } else {
      rules.push(rule);
    }
    break;
  }

  writeCodexHooks(config);
}
