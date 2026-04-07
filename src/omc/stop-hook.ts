import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULTS } from '../constants.js';
import { loadConfig } from '../lib/config.js';

const SIGNAL_TTL_MS = 60 * 60 * 1000; // 1 hour

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const workCompleteFile = join(projectDir, DEFAULTS.workCompleteFile);
const config = loadConfig(projectDir);
const claudeTurnEndStrategy = config.claude?.turnEnd?.strategy ?? config.omc?.turnEnd?.strategy;

function writeJson(output: unknown): void {
  process.stdout.write(JSON.stringify(output));
}

if (claudeTurnEndStrategy === 'off') {
  writeJson({});
  process.exit(0);
} else if (!existsSync(workCompleteFile)) {
  // Missing .work-complete: agent hasn't called submit_turn_complete
  process.stderr.write(
    '[context] Warning: Session ended without submit_turn_complete. Call submit_turn_complete before ending your session.\n'
  );
  writeJson({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext:
        "TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input.",
    },
  });
  process.exit(0);
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

  const warnings: string[] = [];

  try {
    const checks = config.smokeChecks ?? [];
    const now = Date.now();

    for (const check of checks) {
      const signalPath = resolve(projectDir, check.signal);
      if (!existsSync(signalPath)) {
        warnings.push(`Signal file missing for check "${check.name}": ${check.signal}`);
        process.stderr.write(
          `[context] Warning: Signal file missing for check "${check.name}": ${check.signal}\n`
        );
        continue;
      }

      try {
        const raw = readFileSync(signalPath, 'utf-8');
        const timestampMatch = raw.match(/^timestamp=(\d+)$/m);
        if (!timestampMatch) {
          warnings.push(`Signal file for check "${check.name}" has no valid timestamp.`);
          process.stderr.write(
            `[context] Warning: Signal file for check "${check.name}" has no valid timestamp.\n`
          );
          continue;
        }
        const timestamp = parseInt(timestampMatch[1], 10);
        const ageMs = now - timestamp;
        if (ageMs > SIGNAL_TTL_MS) {
          const msg = `Signal file for check "${check.name}" is stale (age: ${Math.round(ageMs / 60_000)}min, TTL: 60min). Re-run run_smoke_check("${check.name}").`;
          warnings.push(msg);
          process.stderr.write(`[context] Warning: ${msg}\n`);
        }
      } catch {
        /* silently ignore per-file read errors */
      }
    }
  } catch {
    /* Config load errors are non-fatal in stop hook */
  }

  if (warnings.length > 0) {
    const additionalContext =
      "TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input.\n\nWarnings:\n" +
      warnings.map((w) => `- ${w}`).join('\n');

    writeJson({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext,
      },
    });
  } else {
    writeJson({});
  }

  process.exit(0);
}
