import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock loadConfig
vi.mock('../lib/config.js', () => ({
  loadConfig: vi.fn(),
}));

import { loadConfig } from '../lib/config.js';

async function runStopHook(
  projectDir: string
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const stderrMessages: string[] = [];
  const stdoutMessages: string[] = [];

  let exitCode = -1;

  vi.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
    stderrMessages.push(String(msg));
    return true;
  });

  vi.spyOn(process.stdout, 'write').mockImplementation((msg: string | Uint8Array) => {
    stdoutMessages.push(String(msg));
    return true;
  });

  vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    exitCode = Number(code ?? 0);
    return undefined as never;
  });

  // Set env so stop-hook uses our tmpDir
  const origEnv = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = projectDir;

  try {
    // Re-import the stop hook module (it runs at module level)
    // Use dynamic import with cache busting
    vi.resetModules();
    await import('./stop-hook.js');
  } finally {
    process.env.CLAUDE_PROJECT_DIR = origEnv;
    vi.mocked(process.stderr.write).mockRestore?.();
    vi.mocked(process.stdout.write).mockRestore?.();
    vi.mocked(process.exit).mockRestore?.();
  }

  return { exitCode, stderr: stderrMessages.join(''), stdout: stdoutMessages.join('') };
}

describe('stop-hook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `stop-hook-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, '.context'), { recursive: true });
    vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('always exits with code 0', async () => {
    const { exitCode } = await runStopHook(tmpDir);
    expect(exitCode).toBe(0);
  });

  it('warns when .work-complete is missing', async () => {
    const { stderr } = await runStopHook(tmpDir);
    expect(stderr).toContain('submit_turn_complete');
  });

  it('outputs JSON with hookSpecificOutput when .work-complete is missing', async () => {
    const { stdout } = await runStopHook(tmpDir);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('hookSpecificOutput');
    expect(parsed.hookSpecificOutput.hookEventName).toBe('Stop');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('submit_turn_complete');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('TURN END');
  });

  it('exits 0 with empty checks array (no signal files to check)', async () => {
    // Create .work-complete so no warning for that
    writeFileSync(join(tmpDir, '.context', '.work-complete'), `timestamp=${Date.now()}\n`);
    vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
    const { exitCode, stderr } = await runStopHook(tmpDir);
    expect(exitCode).toBe(0);
    expect(stderr).not.toContain('Signal file');
  });

  it('outputs empty JSON object when work is complete and no warnings', async () => {
    writeFileSync(join(tmpDir, '.context', '.work-complete'), `timestamp=${Date.now()}\n`);
    vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
    const { stdout } = await runStopHook(tmpDir);
    const parsed = JSON.parse(stdout);
    expect(parsed).toEqual({});
  });

  it('exits 0 but warns when signal file is missing', async () => {
    writeFileSync(join(tmpDir, '.context', '.work-complete'), `timestamp=${Date.now()}\n`);
    vi.mocked(loadConfig).mockReturnValue({
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
      ],
    });
    const { exitCode, stderr } = await runStopHook(tmpDir);
    expect(exitCode).toBe(0);
    expect(stderr).toContain('tests');
  });

  it('outputs JSON with additionalContext when signal file is missing', async () => {
    writeFileSync(join(tmpDir, '.context', '.work-complete'), `timestamp=${Date.now()}\n`);
    vi.mocked(loadConfig).mockReturnValue({
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
      ],
    });
    const { stdout } = await runStopHook(tmpDir);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('hookSpecificOutput');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('tests');
  });

  it('exits 0 but warns when signal file is stale', async () => {
    writeFileSync(join(tmpDir, '.context', '.work-complete'), `timestamp=${Date.now()}\n`);
    const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
    writeFileSync(
      join(tmpDir, '.context', '.check-tests-passed'),
      `session_id=\ntimestamp=${staleTimestamp}\n`
    );
    vi.mocked(loadConfig).mockReturnValue({
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
      ],
    });
    const { exitCode, stderr } = await runStopHook(tmpDir);
    expect(exitCode).toBe(0);
    expect(stderr).toContain('stale');
  });

  it('exits 0 with fresh signal file (no warnings)', async () => {
    writeFileSync(join(tmpDir, '.context', '.work-complete'), `timestamp=${Date.now()}\n`);
    writeFileSync(
      join(tmpDir, '.context', '.check-tests-passed'),
      `session_id=\ntimestamp=${Date.now()}\n`
    );
    vi.mocked(loadConfig).mockReturnValue({
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
      ],
    });
    const { exitCode, stderr } = await runStopHook(tmpDir);
    expect(exitCode).toBe(0);
    expect(stderr).not.toContain('stale');
    expect(stderr).not.toContain('missing');
  });
});
