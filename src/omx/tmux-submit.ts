import { spawnSync } from 'node:child_process';

interface TmuxCommandResult {
  ok: boolean;
  error?: string;
}

export interface TmuxSubmitResult {
  ok: boolean;
  attempts: number;
  error?: string;
}

function runTmux(args: string[]): TmuxCommandResult {
  const result = spawnSync('tmux', args, { encoding: 'utf-8' });

  if (result.error) {
    return { ok: false, error: result.error.message };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || '').trim() || `tmux exited ${result.status}`,
    };
  }

  return { ok: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export async function sendTmuxSubmitSequence(
  target: string,
  attempts: number = 3
): Promise<TmuxSubmitResult> {
  const totalAttempts = Math.max(1, Math.floor(attempts));
  const delays = [180, 240, 320, 420];

  for (let index = 0; index < totalAttempts; index += 1) {
    const result = runTmux(['send-keys', '-t', target, 'C-m']);
    if (!result.ok) {
      return {
        ok: false,
        attempts: index + 1,
        error: result.error,
      };
    }

    const delay = delays[index] ?? delays.at(-1) ?? 320;
    await sleep(delay);
  }

  return {
    ok: true,
    attempts: totalAttempts,
  };
}
