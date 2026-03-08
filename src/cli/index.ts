#!/usr/bin/env bun
import { runUpdate } from './commands/update.js';

export function printHelp(out?: (s: string) => void): void {
  const write = out ?? ((s: string) => process.stdout.write(s));
  write('Usage: context <command>\n\n');
  write('Commands:\n');
  write('  update [all] [path]        Force-update all scaffold files\n');
  write('  update prompt [path]       Force-update prompt files only\n');
  write('  update plugin [version]    Update @ksm0709/context package\n');
  write('\n');
}

export function runCli(argv: string[]): void {
  const [command, ...rest] = argv;

  switch (command) {
    case 'update':
      runUpdate(rest);
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

// Entry point — only runs when executed directly, not when imported in tests
if (import.meta.path === Bun.main) {
  runCli(process.argv.slice(2));
}
