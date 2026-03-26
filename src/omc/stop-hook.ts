import { existsSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '../constants.js';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const workCompleteFile = join(projectDir, DEFAULTS.workCompleteFile);

if (!existsSync(workCompleteFile)) {
  process.stderr.write(
    '[context] Warning: Session ended without submit_turn_complete. Work may not be recorded in daily notes.\n'
  );
  process.exit(0);
}

try {
  const stat = statSync(workCompleteFile);
  const ageMs = Date.now() - stat.mtimeMs;
  if (ageMs > 24 * 60 * 60 * 1000) {
    unlinkSync(workCompleteFile);
  }
} catch {
  /* silently ignore */
}
