import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { updateScaffold } from '../../lib/scaffold.js';
import { installOmc, installOmx, resolveOmxSource } from './install.js';
import { readClaudeSettings } from '../../shared/claude-settings.js';

const KNOWN_SUBCOMMANDS = ['all', 'prompt', 'plugin'];

export function runUpdate(args: string[]): void {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case undefined:
    case 'all':
      runUpdateAll(resolve(rest[0] ?? process.cwd()));
      break;
    case 'prompt':
      process.stdout.write('Prompt update is no longer supported.\n');
      break;
    case 'plugin':
      runUpdatePlugin(rest[0] ?? 'latest');
      break;
    default:
      // Backward compat: if subcommand is not a known subcommand, treat as projectDir
      if (!KNOWN_SUBCOMMANDS.includes(subcommand)) {
        runUpdateAll(resolve(subcommand));
      } else {
        process.stderr.write(`Unknown update subcommand: ${subcommand}\n`);
        process.exit(1);
      }
      break;
  }
}

export function isOmxInstalled(projectDir: string): boolean {
  return existsSync(join(projectDir, '.omx', 'hooks', 'context.mjs'));
}

export function isOmcInstalled(): boolean {
  try {
    const settings = readClaudeSettings();
    return settings.mcpServers != null && 'context-mcp' in settings.mcpServers;
  } catch {
    return false;
  }
}

function runUpdateAll(projectDir: string): void {
  const updated = updateScaffold(projectDir);

  if (updated.length === 0) {
    process.stdout.write('All scaffold files are already up to date.\n');
  } else {
    process.stdout.write(`Updated ${updated.length} file(s):\n`);
    for (const f of updated) {
      process.stdout.write(`  - ${f}\n`);
    }
  }

  // Auto-reinstall omc/omx if already installed
  if (isOmcInstalled()) {
    process.stdout.write('\nRe-installing omc hooks and settings...\n');
    installOmc(projectDir);
  }

  if (isOmxInstalled(projectDir)) {
    const source = resolveOmxSource();
    if (source) {
      process.stdout.write('\nRe-installing omx plugin...\n');
      installOmx(projectDir, source);
    } else {
      process.stderr.write('\nWarning: could not resolve omx source; skipping omx reinstall.\n');
    }
  }
}

export function detectPackageManager(): string {
  if (existsSync('bun.lock') || existsSync('bun.lockb')) return 'bun';
  if (existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (existsSync('yarn.lock')) return 'yarn';
  if (existsSync('package-lock.json')) return 'npm';
  return 'bun';
}

interface GlobalInstall {
  pm: string;
  label: string;
  installCmd: string[];
}

export function detectGlobalInstalls(): GlobalInstall[] {
  const installs: GlobalInstall[] = [];

  // Check bun global
  const bunGlobalBin = join(homedir(), '.bun', 'bin', 'context');
  if (existsSync(bunGlobalBin)) {
    installs.push({ pm: 'bun', label: 'bun global', installCmd: ['bun', 'install', '-g'] });
  }

  // Check npm/nvm global — resolve active binary via `which`
  const spawnSync = globalThis.Bun?.spawnSync;
  if (spawnSync) {
    const whichResult = spawnSync(['which', 'context']);
    if (whichResult.exitCode === 0) {
      const binPath = whichResult.stdout.toString().trim();
      // If active binary is NOT bun and NOT a local node_modules, it's npm/nvm global
      if (binPath && !binPath.includes('.bun') && !binPath.includes('node_modules')) {
        installs.push({ pm: 'npm', label: 'npm global', installCmd: ['npm', 'install', '-g'] });
      }
    }
  }

  return installs;
}

export function isGloballyInstalled(): boolean {
  return detectGlobalInstalls().length > 0;
}

export function runUpdatePlugin(version: string): void {
  const pkg = `@ksm0709/context@${version}`;
  const spawnSync = globalThis.Bun?.spawnSync;
  if (!spawnSync) {
    process.stderr.write('Bun runtime required for plugin updates.\n');
    process.exit(1);
    return;
  }

  // Update all detected global installations
  const globalInstalls = detectGlobalInstalls();
  for (const { label, installCmd } of globalInstalls) {
    process.stdout.write(`Updating ${label} ${pkg}...\n`);
    const result = spawnSync([...installCmd, pkg]);
    if (result.exitCode !== 0) {
      process.stderr.write(`Failed to update ${label}: ${result.stderr.toString()}\n`);
      process.exit(1);
      return;
    }
    process.stdout.write(`Successfully updated ${label} ${pkg}.\n`);
  }

  // Update local installation
  const pm = detectPackageManager();
  process.stdout.write(`Updating local ${pkg} using ${pm}...\n`);

  const localResult = spawnSync([pm, 'add', pkg]);
  if (localResult.exitCode !== 0) {
    process.stderr.write(`Failed to update local: ${localResult.stderr.toString()}\n`);
    process.exit(1);
    return;
  }
  process.stdout.write(`Successfully updated local ${pkg}.\n`);
}
