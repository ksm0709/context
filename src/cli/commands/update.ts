import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { updateScaffold, updatePrompts } from '../../lib/scaffold.js';

const KNOWN_SUBCOMMANDS = ['all', 'prompt', 'plugin'];

export function runUpdate(args: string[]): void {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case undefined:
    case 'all':
      runUpdateAll(resolve(rest[0] ?? process.cwd()));
      break;
    case 'prompt':
      runUpdatePrompt(resolve(rest[0] ?? process.cwd()));
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
}

function runUpdatePrompt(projectDir: string): void {
  const updated = updatePrompts(projectDir);

  if (updated.length === 0) {
    process.stdout.write('All prompt files are already up to date.\n');
  } else {
    process.stdout.write(`Updated ${updated.length} prompt file(s):\n`);
    for (const f of updated) {
      process.stdout.write(`  - ${f}\n`);
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

export function isGloballyInstalled(): boolean {
  const globalBin = join(homedir(), '.bun', 'bin', 'context');
  return existsSync(globalBin);
}

export function runUpdatePlugin(version: string): void {
  const pkg = `@ksm0709/context@${version}`;
  const globalInstalled = isGloballyInstalled();

  // Update global installation first if present
  if (globalInstalled) {
    process.stdout.write(`Updating global ${pkg}...\n`);
    const globalResult = Bun.spawnSync(['bun', 'install', '-g', pkg]);
    if (globalResult.exitCode !== 0) {
      process.stderr.write(`Failed to update global: ${globalResult.stderr.toString()}\n`);
      process.exit(1);
      return;
    }
    process.stdout.write(`Successfully updated global ${pkg}.\n`);
  }

  // Update local installation
  const pm = detectPackageManager();
  process.stdout.write(`Updating local ${pkg} using ${pm}...\n`);

  const localResult = Bun.spawnSync([pm, 'add', pkg]);
  if (localResult.exitCode !== 0) {
    process.stderr.write(`Failed to update local: ${localResult.stderr.toString()}\n`);
    process.exit(1);
    return;
  }
  process.stdout.write(`Successfully updated local ${pkg}.\n`);
}
