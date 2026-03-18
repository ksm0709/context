import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runMigrate } from './migrate.js';

describe('runMigrate', () => {
  let tmpDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(() => {
    tmpDir = join(tmpdir(), `migrate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    stdout = [];
    stderr = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      stdout.push(String(s));
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => {
      stderr.push(String(s));
      return true;
    });
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('.opencode/context/ does not exist → exit 0 + "Nothing to migrate"', () => {
    runMigrate([tmpDir]);

    expect(stdout.join('')).toContain('Nothing to migrate');
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('.context/ already exists → exit 1 + abort', () => {
    mkdirSync(join(tmpDir, '.opencode', 'context'), { recursive: true });
    mkdirSync(join(tmpDir, '.context'), { recursive: true });

    runMigrate([tmpDir]);

    expect(stderr.join('')).toContain('Target .context/ already exists. Aborting.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('normal migration → copies files + updates config paths + deletes old dir', () => {
    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(join(legacyDir, 'prompts'), { recursive: true });
    mkdirSync(join(legacyDir, 'templates'), { recursive: true });

    writeFileSync(
      join(legacyDir, 'config.jsonc'),
      JSON.stringify({
        prompts: {
          turnStart: '.opencode/context/prompts/turn-start.md',
          turnEnd: '.opencode/context/prompts/turn-end.md',
        },
      })
    );
    writeFileSync(join(legacyDir, 'prompts', 'turn-start.md'), 'start content');
    writeFileSync(join(legacyDir, 'prompts', 'turn-end.md'), 'end content');
    writeFileSync(join(legacyDir, 'templates', 'adr.md'), 'adr template');

    runMigrate([tmpDir]);

    // Files copied
    expect(existsSync(join(tmpDir, '.context', 'config.jsonc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'prompts', 'turn-end.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'templates', 'adr.md'))).toBe(true);

    // File contents preserved
    expect(readFileSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'), 'utf-8')).toBe(
      'start content'
    );
    expect(readFileSync(join(tmpDir, '.context', 'templates', 'adr.md'), 'utf-8')).toBe(
      'adr template'
    );

    // Config paths updated
    const config = readFileSync(join(tmpDir, '.context', 'config.jsonc'), 'utf-8');
    expect(config).toContain('prompts/turn-start.md');
    expect(config).toContain('prompts/turn-end.md');
    expect(config).not.toContain('.opencode/context/');

    // Old directory deleted
    expect(existsSync(join(tmpDir, '.opencode', 'context'))).toBe(false);

    // Success message
    expect(stdout.join('')).toContain('Migrated .opencode/context/');
  });

  it('idempotency — after migration, re-run says "Nothing to migrate"', () => {
    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(join(legacyDir, 'prompts'), { recursive: true });
    writeFileSync(join(legacyDir, 'config.jsonc'), '{}');
    writeFileSync(join(legacyDir, 'prompts', 'turn-start.md'), 'content');

    runMigrate([tmpDir]);
    stdout.length = 0;

    runMigrate([tmpDir]);

    expect(stdout.join('')).toContain('Nothing to migrate');
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it('--keep flag preserves old directory after migration', () => {
    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(join(legacyDir, 'prompts'), { recursive: true });
    writeFileSync(join(legacyDir, 'config.jsonc'), '{}');
    writeFileSync(join(legacyDir, 'prompts', 'turn-start.md'), 'content');

    runMigrate(['--keep', tmpDir]);

    expect(existsSync(join(tmpDir, '.context'))).toBe(true);
    expect(existsSync(join(tmpDir, '.opencode', 'context'))).toBe(true);
    expect(stdout.join('')).toContain('Migrated .opencode/context/');
  });

  it('config.jsonc with relative paths already → left unchanged', () => {
    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(join(legacyDir, 'prompts'), { recursive: true });

    const relativeConfig = JSON.stringify({
      prompts: {
        turnStart: 'prompts/turn-start.md',
        turnEnd: 'prompts/turn-end.md',
      },
    });
    writeFileSync(join(legacyDir, 'config.jsonc'), relativeConfig);

    runMigrate([tmpDir]);

    const config = readFileSync(join(tmpDir, '.context', 'config.jsonc'), 'utf-8');
    expect(config).toBe(relativeConfig);
  });

  it('no config.jsonc → migration still succeeds', () => {
    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(join(legacyDir, 'prompts'), { recursive: true });
    writeFileSync(join(legacyDir, 'prompts', 'turn-start.md'), 'content');

    runMigrate([tmpDir]);

    expect(existsSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'))).toBe(true);
    expect(stdout.join('')).toContain('Migrated .opencode/context/');
  });
});
