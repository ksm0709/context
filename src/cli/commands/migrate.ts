import { resolve, join } from 'node:path';
import { existsSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const LEGACY_CONTEXT_DIR = '.opencode/context';
const NEW_CONTEXT_DIR = '.context';

export function runMigrate(args: string[]): void {
  const keepFlag = args.includes('--keep');
  const pathArg = args.find((a) => !a.startsWith('--'));
  const projectDir = resolve(pathArg ?? process.cwd());

  const legacyDir = join(projectDir, LEGACY_CONTEXT_DIR);
  const newDir = join(projectDir, NEW_CONTEXT_DIR);

  if (!existsSync(legacyDir)) {
    process.stdout.write('Nothing to migrate.\n');
    return;
  }

  if (existsSync(newDir)) {
    process.stderr.write('Target .context/ already exists. Aborting.\n');
    process.exit(1);
    return;
  }

  cpSync(legacyDir, newDir, { recursive: true });
  updateConfigPaths(newDir);

  if (!keepFlag) {
    rmSync(legacyDir, { recursive: true, force: true });
  }

  process.stdout.write('Migrated .opencode/context/ \u2192 .context/\n');
}

function updateConfigPaths(contextDir: string): void {
  const configPath = join(contextDir, 'config.jsonc');
  if (!existsSync(configPath)) return;

  try {
    const content = readFileSync(configPath, 'utf-8');
    const updated = content.replaceAll('.opencode/context/', '');
    if (updated !== content) {
      writeFileSync(configPath, updated, 'utf-8');
    }
  } catch {
    /* file unreadable */
  }
}
