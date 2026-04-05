import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULTS } from '../constants.js';
import { loadConfig } from '../lib/config.js';

const SIGNAL_TTL_MS = 60 * 60 * 1000; // 1 hour

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const workCompleteFile = join(projectDir, DEFAULTS.workCompleteFile);

if (!existsSync(workCompleteFile)) {
  process.stderr.write(
    '[context] Warning: Session ended without submit_turn_complete. Call submit_turn_complete before ending your session.\n'
  );
} else {
  try {
    const stat = statSync(workCompleteFile);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > 24 * 60 * 60 * 1000) {
      unlinkSync(workCompleteFile);
    }
  } catch {
    /* silently ignore */
  }
}

try {
  const config = loadConfig(projectDir);
  const checks = config.checks ?? [];
  const now = Date.now();

  for (const check of checks) {
    const signalPath = resolve(projectDir, check.signal);
    if (!existsSync(signalPath)) {
      process.stderr.write(
        `[context] Warning: Signal file missing for check "${check.name}": ${check.signal}\n`
      );
      continue;
    }

    try {
      const raw = readFileSync(signalPath, 'utf-8');
      const timestampMatch = raw.match(/^timestamp=(\d+)$/m);
      if (!timestampMatch) {
        process.stderr.write(
          `[context] Warning: Signal file for check "${check.name}" has no valid timestamp.\n`
        );
        continue;
      }
      const timestamp = parseInt(timestampMatch[1], 10);
      const ageMs = now - timestamp;
      if (ageMs > SIGNAL_TTL_MS) {
        process.stderr.write(
          `[context] Warning: Signal file for check "${check.name}" is stale (age: ${Math.round(ageMs / 60_000)}min, TTL: 60min). Re-run run_smoke_check("${check.name}").\n`
        );
      }
    } catch {
      /* silently ignore per-file read errors */
    }
  }
} catch {
  /* Config load errors are non-fatal in stop hook */
}

process.exit(0);
