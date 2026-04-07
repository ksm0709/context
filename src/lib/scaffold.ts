import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveContextDir } from './context-dir';
import pkg from '../../package.json';

const PLUGIN_VERSION: string = pkg.version;

const DEFAULT_CONFIG = `{
  // Context Plugin Configuration
  // See: https://github.com/ksm0709/context
  "codex": {
    // Continue the turn at Stop until submit_turn_complete has been called
    "turnEnd": {
      "strategy": "stop-hook"
    }
  }
}`;

export function scaffoldIfNeeded(projectDir: string): boolean {
  const contextDir = join(projectDir, resolveContextDir(projectDir));

  // Idempotency check: if context dir exists, skip scaffolding
  if (existsSync(contextDir)) {
    return false;
  }

  try {
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, 'config.jsonc'), DEFAULT_CONFIG, 'utf-8');
    writeVersion(contextDir, PLUGIN_VERSION);
    return true;
  } catch {
    return false;
  }
}

export function updateScaffold(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
  mkdirSync(contextDir, { recursive: true });

  const updated: string[] = [];
  const configPath = join(contextDir, 'config.jsonc');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DEFAULT_CONFIG, 'utf-8');
    updated.push('config.jsonc');
  }

  writeVersion(contextDir, PLUGIN_VERSION);
  return updated;
}

/**
 * Read stored plugin version from the resolved context directory.
 * Returns null if file is missing or unreadable.
 */
export function getStoredVersion(projectDir: string): string | null {
  try {
    return readFileSync(
      join(projectDir, resolveContextDir(projectDir), '.version'),
      'utf-8'
    ).trim();
  } catch {
    return null;
  }
}

/**
 * Write plugin version to the resolved context directory.
 */
export function writeVersion(contextDir: string, version: string): void {
  writeFileSync(join(contextDir, '.version'), version, 'utf-8');
}

/**
 * Auto-update config when plugin version changes.
 * Skips config.jsonc to preserve user customizations.
 * Returns list of updated paths, or empty array if nothing changed.
 */
export function autoUpdateTemplates(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
  if (!existsSync(contextDir)) return [];

  const stored = getStoredVersion(projectDir);
  if (stored === PLUGIN_VERSION) return [];

  writeVersion(contextDir, PLUGIN_VERSION);
  return [];
}
