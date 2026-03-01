import { updateScaffold } from '../../lib/scaffold.js';

export function runUpdate(projectDir: string): void {
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
