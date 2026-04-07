import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '../constants.js';
import { loadConfig } from '../lib/config.js';
import { resolveProjectPaths } from '../lib/project-root.js';
import { getSessionId } from '../lib/session.js';

interface StopInput {
  cwd?: string;
  turn_id?: string;
  stop_hook_active?: boolean;
}

function parseWorkComplete(content: string): { sessionId: string; turnId?: string } {
  const result: { sessionId: string; turnId?: string } = { sessionId: '' };
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('session_id=')) {
      result.sessionId = trimmed.substring('session_id='.length).trim();
    } else if (trimmed.startsWith('turn_id=')) {
      result.turnId = trimmed.substring('turn_id='.length).trim();
    }
  }
  return result;
}

const input = JSON.parse(await Bun.stdin.text()) as StopInput;
const projectDir = input.cwd ?? process.cwd();
const paths = resolveProjectPaths(projectDir);
const config = loadConfig(paths.contextParent);
const strategy = config.codex?.turnEnd?.strategy ?? 'stop-hook';

if (strategy !== 'stop-hook' || input.stop_hook_active) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const currentSessionId = getSessionId();

const workCompleteFile = join(paths.contextParent, DEFAULTS.workCompleteFile);
if (existsSync(workCompleteFile)) {
  let staleFile = false;
  try {
    const ageMs = Date.now() - statSync(workCompleteFile).mtimeMs;
    if (ageMs > 24 * 60 * 60 * 1000) {
      unlinkSync(workCompleteFile);
      staleFile = true;
    }
  } catch { /* ignore */ }

  if (!staleFile) {
    const content = readFileSync(workCompleteFile, 'utf8');
    const { sessionId: fileSessionId } = parseWorkComplete(content);

    const sessionMismatch = currentSessionId && fileSessionId && fileSessionId !== currentSessionId;

    if (sessionMismatch) {
      try { unlinkSync(workCompleteFile); } catch { /* ignore */ }
    } else {
      try { unlinkSync(workCompleteFile); } catch { /* ignore */ }
      process.stdout.write(JSON.stringify({ continue: true }));
      process.exit(0);
    }
  }
}

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason:
      "TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input.",
  })
);
