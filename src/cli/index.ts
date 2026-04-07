#!/usr/bin/env bun
import { runUpdate } from './commands/update.js';
import { runMigrate } from './commands/migrate.js';
import { runInstall } from './commands/install.js';
import pkg from '../../package.json';

const PLUGIN_VERSION = pkg.version;

export function printHelp(out?: (s: string) => void): void {
  const write = out ?? ((s: string) => process.stdout.write(s));
  write(`Context Plugin CLI v${PLUGIN_VERSION}\n\n`);
  write('Usage: context <command> [options]\n\n');
  write('Commands:\n');
  write(
    '  update [all] [path]        Update scaffold + install Claude/Codex/OpenCode integrations\n'
  );
  write('  update omx [path]          Force-update config + reinstall OMX only\n');
  write('  update plugin [version]    Update @ksm0709/context package\n');
  write('  migrate [path] [--keep]    Migrate .opencode/context/ → .context/\n');
  write('  install omx                Install OMX hook plugin to .omx/hooks/\n');
  write('  install omc                Install OMC hooks/MCP to Claude settings\n');
  write('\n');
}

export function runCli(argv: string[]): void {
  const [command, ...rest] = argv;

  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  switch (command) {
    case 'update':
      runUpdate(rest);
      break;
    case 'migrate':
      runMigrate(rest);
      break;
    case 'install':
      runInstall(rest);
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
