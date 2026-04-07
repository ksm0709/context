import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULTS } from '../constants.js';
import { loadConfig } from '../lib/config.js';
import { getSessionId } from '../lib/session.js';

const SIGNAL_TTL_MS = 60 * 60 * 1000; // 1 hour

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const workCompleteFile = join(projectDir, DEFAULTS.workCompleteFile);
const config = loadConfig(projectDir);
const claudeTurnEndStrategy = config.claude?.turnEnd?.strategy ?? config.omc?.turnEnd?.strategy;

function writeJson(output: unknown): void {
  process.stdout.write(JSON.stringify(output));
}

// Read stdin to get hook context (stop_hook_active prevents infinite loops)
let stopHookActive = false;
let stdinSessionId = '';
try {
  const isTTY = process.stdin.isTTY;
  if (!isTTY) {
    const stdinData = readFileSync('/dev/stdin', 'utf-8');
    const input = JSON.parse(stdinData) as { stop_hook_active?: boolean; session_id?: string };
    stopHookActive = input.stop_hook_active === true;
    stdinSessionId = input.session_id ?? '';
  }
} catch {
  // stdin unavailable or not JSON — assume not re-entrant
}

// Resolve session ID: stdin value takes priority, env vars as fallback
const currentSessionId = getSessionId(stdinSessionId);

if (claudeTurnEndStrategy === 'off' || stopHookActive) {
  // Strategy disabled or re-entrant call — allow stop
  writeJson({});
} else if (!existsSync(workCompleteFile)) {
  // Agent hasn't called submit_turn_complete — block stopping
  process.stderr.write(
    '[context] Warning: Session ended without submit_turn_complete. Call submit_turn_complete before ending your session.\n'
  );
  writeJson({
    decision: 'block',
    reason:
      "TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input.",
  });
} else {
  // .work-complete exists — check staleness, pid, and signal file warnings

  // Fix 1: Check age — if >24h, delete and block (treat as missing)
  let staleFile = false;
  try {
    const stat = statSync(workCompleteFile);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > 24 * 60 * 60 * 1000) {
      unlinkSync(workCompleteFile);
      staleFile = true;
    }
  } catch {
    /* silently ignore */
  }

  if (staleFile) {
    process.stderr.write(
      '[context] Warning: .work-complete file is stale (>24h). Call submit_turn_complete to verify quality gates.\n'
    );
    writeJson({
      decision: 'block',
      reason:
        "TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input.",
    });
  } else {
    // Check session_id — if mismatch, block (handles cross-session and team agent bypass)
    let sessionMismatch = false;
    try {
      const fileContent = readFileSync(workCompleteFile, 'utf-8');
      const sessionMatch = fileContent.match(/^session_id=(.+)$/m);
      const fileSessionId = sessionMatch?.[1]?.trim() ?? '';
      if (currentSessionId && fileSessionId && fileSessionId !== currentSessionId) {
        sessionMismatch = true;
      }
    } catch {
      /* silently ignore */
    }

    if (sessionMismatch) {
      try {
        unlinkSync(workCompleteFile);
      } catch {
        /* ignore cleanup failures */
      }
      process.stderr.write(
        '[context] Warning: .work-complete is from a different session. Resetting quality gate.\n'
      );
      writeJson({
        decision: 'block',
        reason:
          "TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input.",
      });
    } else {
      const warnings: string[] = [];

      try {
        const checks = config.smokeChecks ?? [];
        const now = Date.now();

        for (const check of checks) {
          if (check.enabled === false) continue;
          const signalPath = resolve(projectDir, check.signal);
          if (!existsSync(signalPath)) {
            const msg = `Signal file missing for check "${check.name}": ${check.signal}`;
            warnings.push(msg);
            process.stderr.write(`[context] Warning: ${msg}\n`);
            continue;
          }

          try {
            const raw = readFileSync(signalPath, 'utf-8');
            const timestampMatch = raw.match(/^timestamp=(\d+)$/m);
            if (!timestampMatch) {
              const msg = `Signal file for check "${check.name}" has no valid timestamp.`;
              warnings.push(msg);
              process.stderr.write(`[context] Warning: ${msg}\n`);
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

      // Consume .work-complete — next turn requires a fresh submit_turn_complete call
      try {
        unlinkSync(workCompleteFile);
      } catch {
        /* ignore cleanup failures */
      }

      // Do NOT inject systemMessage after consuming the file — it would trigger a new turn,
      // causing the stop hook to run again without a .work-complete file and block.
      // Warnings are already written to stderr above.
      writeJson({});
    }
  }
}

process.exit(0);
