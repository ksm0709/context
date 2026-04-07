import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

export function getCodexHooksPath(projectDir: string): string {
  return join(projectDir, '.codex', 'hooks.json');
}

export function readCodexHooks(projectDir: string): CodexHooksConfig {
  const hooksPath = getCodexHooksPath(projectDir);
  if (!existsSync(hooksPath)) {
    return {};
  }

  return JSON.parse(readFileSync(hooksPath, 'utf8')) as CodexHooksConfig;
}

export function writeCodexHooks(projectDir: string, config: CodexHooksConfig): void {
  const hooksPath = getCodexHooksPath(projectDir);
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

export function registerCodexHook(projectDir: string, event: string, rule: CodexHookRule): void {
  const config = readCodexHooks(projectDir);
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

  writeCodexHooks(projectDir, config);
}
