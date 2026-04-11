import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { removeMcpServer, removeHook } from '../../shared/claude-settings.js';
import { removeFromGlobalInstructions } from '../../shared/global-instructions.js';
import { removeFromAgentsMd } from '../../shared/agents-md.js';

export function uninstallOmx(projectDir: string): void {
  const targetDir = join(projectDir, '.omx', 'hooks');
  const targetFile = join(targetDir, 'context.mjs');

  if (existsSync(targetFile)) {
    rmSync(targetFile, { force: true });
    process.stdout.write(`Removed OMX hook from ${targetFile}\n`);
  } else {
    process.stdout.write(`OMX hook not found at ${targetFile}\n`);
  }

  try {
    const hooksDirContent = existsSync(targetDir)
      ? Array.from(require('node:fs').readdirSync(targetDir))
      : [];
    if (hooksDirContent.length === 0 && existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    //
  }

  removeFromGlobalInstructions('codex');
  process.stdout.write('Removed workflow context from ~/.codex/instructions.md\n');

  process.stdout.write('Successfully uninstalled context (omx) plugin.\n');
}

export function uninstallOmc(projectDir: string): void {
  const agentsMdPath = join(projectDir, 'AGENTS.md');
  removeFromAgentsMd(agentsMdPath);
  process.stdout.write('Removed workflow context from project AGENTS.md\n');

  removeMcpServer('context-mcp');
  removeMcpServer('context_mcp');
  try {
    execSync('claude mcp remove -s user context-mcp', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    //
  }

  removeHook('SessionStart', 'session-start-hook.js');
  removeHook('Stop', 'stop-hook.js');

  removeFromGlobalInstructions('claude');
  process.stdout.write('Removed workflow context from ~/.claude/CLAUDE.md\n');

  process.stdout.write('Successfully uninstalled context (omc) plugin.\n');
}

export function runRemove(args: string[]): void {
  const [subcommand] = args;

  switch (subcommand) {
    case 'omx':
    case 'codex':
      uninstallOmx(process.cwd());
      break;
    case 'omc':
    case 'claude':
      uninstallOmc(process.cwd());
      break;
    case undefined:
      process.stderr.write('Missing remove target. Usage: context remove <omx|omc|claude|codex>\n');
      process.exit(1);
      break;
    default:
      process.stderr.write(`Unknown remove target: ${subcommand}\n`);
      process.exit(1);
  }
}


  // Also try to clean up the directory if it's empty, but wrap in try/catch to be safe
  try {
    const hooksDirContent = existsSync(targetDir)
      ? Array.from(require('node:fs').readdirSync(targetDir))
      : [];
    if (hooksDirContent.length === 0 && existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }

  removeFromGlobalInstructions('codex');
  process.stdout.write('Removed workflow context from ~/.codex/instructions.md\n');

  process.stdout.write('Successfully uninstalled context (omx) plugin.\n');
}

export function uninstallOmc(projectDir: string): void {
  // 1. Remove AGENTS.md injections
  const agentsMdPath = join(projectDir, 'AGENTS.md');
  removeFromAgentsMd(agentsMdPath);
  process.stdout.write('Removed workflow context from project AGENTS.md\n');

  // 2. Clean up settings.json and remove via Claude CLI
  removeMcpServer('context-mcp');
  removeMcpServer('context_mcp');
  try {
    execSync('claude mcp remove -s user context-mcp', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    /* ignore if not found */
  }

  // 3. Remove SessionStart and Stop hooks for context plugin specifically
  removeHook('SessionStart', 'session-start-hook.js');
  removeHook('Stop', 'stop-hook.js');

  // 4. Remove from Claude Code's global CLAUDE.md
  removeFromGlobalInstructions('claude');
  process.stdout.write('Removed workflow context from ~/.claude/CLAUDE.md\n');

  process.stdout.write('Successfully uninstalled context (omc) plugin.\n');
}

export function runRemove(args: string[]): void {
  const [subcommand] = args;

  switch (subcommand) {
    case 'omx':
    case 'codex':
      uninstallOmx(process.cwd());
      break;
    case 'omc':
    case 'claude':
      uninstallOmc(process.cwd());
      break;
    case undefined:
      process.stderr.write('Missing remove target. Usage: context remove <omx|omc|claude|codex>\n');
      process.exit(1);
      break;
    default:
      process.stderr.write(`Unknown remove target: ${subcommand}\n`);
      process.exit(1);
  }
}
