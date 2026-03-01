#!/usr/bin/env bun
import { resolve } from 'node:path';
import { runUpdate } from './commands/update.js';

export const COMMANDS: Record<string, string> = {
  update: 'Force-update scaffold files to latest plugin version',
};

export function printHelp(out?: (s: string) => void): void {
  const write = out ?? ((s: string) => process.stdout.write(s));
  write('Usage: context <command>\n\n');
  write('Commands:\n');
  for (const [name, desc] of Object.entries(COMMANDS)) {
    write(`  ${name.padEnd(12)}${desc}\n`);
  }
  write('\n');
}

export function runCli(argv: string[]): void {
  const [command, ...rest] = argv;
  const projectDir = resolve(rest[0] ?? process.cwd());

  switch (command) {
    case 'update':
      runUpdate(projectDir);
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
