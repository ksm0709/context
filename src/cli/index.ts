#!/usr/bin/env bun
import { runUpdate } from './commands/update.js';
import { runRemove } from './commands/remove.js';
import pkg from '../../package.json';

const PLUGIN_VERSION = pkg.version;
const PACKAGE_NAME = '@ksm0709/context';

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): SemverParts | null {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function isRemoteVersionNewer(currentVersion: string, remoteVersion: string): boolean {
  const current = parseSemver(currentVersion);
  const remote = parseSemver(remoteVersion);

  if (!current || !remote) {
    return false;
  }

  if (remote.major !== current.major) {
    return remote.major > current.major;
  }

  if (remote.minor !== current.minor) {
    return remote.minor > current.minor;
  }

  return remote.patch > current.patch;
}

export function getLatestPublishedVersion(): string | null {
  const spawnSync = globalThis.Bun?.spawnSync;
  if (!spawnSync) {
    return null;
  }

  const result = spawnSync(['npm', 'view', PACKAGE_NAME, 'version']);
  if (result.exitCode !== 0) {
    return null;
  }

  const version = result.stdout.toString().trim();
  return version.length > 0 ? version : null;
}

export function printUpdateNoticeIfAvailable(out?: (s: string) => void): void {
  const latestVersion = getLatestPublishedVersion();
  if (!latestVersion || !isRemoteVersionNewer(PLUGIN_VERSION, latestVersion)) {
    return;
  }

  const write = out ?? ((s: string) => process.stdout.write(s));
  write(
    `Update available: ${PLUGIN_VERSION} -> ${latestVersion}. Run \`context update plugin\` to install the latest version.\n\n`
  );
}

export function printHelp(out?: (s: string) => void): void {
  const write = out ?? ((s: string) => process.stdout.write(s));
  write(`Context Plugin CLI v${PLUGIN_VERSION}\n\n`);
  write('Usage: context <command> [options]\n\n');
  write('Commands:\n');
  write(
    '  update [path]              Update scaffold + install Claude/Codex/OpenCode integrations\n'
  );
  write('  update claude [path]       Reinstall Claude/OpenCode integrations only\n');
  write('  update codex [path]        Reinstall Codex integrations only\n');
  write('  update plugin [version]    Update @ksm0709/context package\n');
  write('  migrate [path] [--keep]    Migrate .opencode/context/ → .context/\n');
  write('\n');
}

export function runCli(argv: string[]): void {
  const [command, ...rest] = argv;
  printUpdateNoticeIfAvailable();

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  switch (command) {
    case 'update':
      runUpdate(rest);
      break;
    case 'install':
      if (rest[0] === 'codex') {
        runUpdate(['codex', ...rest.slice(1)]);
        return;
      }

      if (rest[0] === 'claude') {
        runUpdate(['claude', ...rest.slice(1)]);
        return;
      }
      process.stderr.write(
        'Use `context update`, `context update codex`, or `context update claude`.\n'
      );
      process.exit(1);
      break;
    case 'remove':
    case 'uninstall':
      runRemove(rest);
      break;
    case '--version':
    case '-v':
      process.stdout.write(`${PLUGIN_VERSION}\n`);
      break;
    case undefined:
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      printHelp((s) => process.stderr.write(s));
      process.exit(1);
  }
}

const isBunRuntime = typeof Bun !== 'undefined';
const isMainModule = isBunRuntime && import.meta.path === globalThis.Bun?.main;

// Entry point — only runs when executed directly, not when imported in tests
if (isMainModule) {
  runCli(process.argv.slice(2));
}
