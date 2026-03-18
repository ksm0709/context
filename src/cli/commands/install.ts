import { join, resolve, dirname } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export function resolveOmxSource(): string | null {
  try {
    const cliDir = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = resolve(cliDir, '..', '..');
    const source = join(pkgRoot, 'dist', 'omx', 'index.mjs');
    if (existsSync(source)) return source;
  } catch {
    /* dirname resolution unavailable */
  }

  try {
    const req = createRequire(import.meta.url);
    return req.resolve('@ksm0709/context/omx');
  } catch {
    return null;
  }
}

export function installOmx(projectDir: string, sourcePath: string): void {
  if (!existsSync(sourcePath)) {
    process.stderr.write(`Could not find OMX plugin source file: ${sourcePath}\n`);
    process.exit(1);
    return;
  }

  const targetDir = join(projectDir, '.omx', 'hooks');
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(sourcePath, join(targetDir, 'context.mjs'));

  process.stdout.write('Installed context plugin to .omx/hooks/context.mjs\n');
}

export function runInstall(args: string[]): void {
  const [subcommand] = args;

  switch (subcommand) {
    case 'omx': {
      const source = resolveOmxSource();
      if (!source) {
        process.stderr.write('Could not find OMX plugin source file (dist/omx/index.mjs).\n');
        process.exit(1);
        return;
      }
      installOmx(process.cwd(), source);
      break;
    }
    case undefined:
      process.stderr.write('Missing install target. Usage: context install omx\n');
      process.exit(1);
      break;
    default:
      process.stderr.write(`Unknown install target: ${subcommand}\n`);
      process.exit(1);
  }
}
