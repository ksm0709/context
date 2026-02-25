import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scaffoldIfNeeded } from './scaffold';

describe('scaffoldIfNeeded', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `scaffold-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .opencode/context/ directory structure when not exists', () => {
    const result = scaffoldIfNeeded(tmpDir);

    expect(result).toBe(true);
    expect(existsSync(join(tmpDir, '.opencode', 'context'))).toBe(true);
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'prompts'))).toBe(true);
  });

  it('creates config.jsonc with valid content', () => {
    scaffoldIfNeeded(tmpDir);

    const configPath = join(tmpDir, '.opencode', 'context', 'config.jsonc');
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('Context Plugin Configuration');
    expect(content).toContain('prompts');
    expect(content).toContain('turnStart');
    expect(content).toContain('turnEnd');
    expect(content).toContain('knowledge');
  });

  it('creates turn-start.md and turn-end.md', () => {
    scaffoldIfNeeded(tmpDir);

    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    expect(existsSync(join(promptsDir, 'turn-start.md'))).toBe(true);
    expect(existsSync(join(promptsDir, 'turn-end.md'))).toBe(true);

    const turnStart = readFileSync(join(promptsDir, 'turn-start.md'), 'utf-8');
    expect(turnStart).toContain('Knowledge Context');

    const turnEnd = readFileSync(join(promptsDir, 'turn-end.md'), 'utf-8');
    expect(turnEnd).toContain('작업 마무리 체크리스트');
  });

  it('returns true on first scaffold, false when already exists (idempotent)', () => {
    const firstResult = scaffoldIfNeeded(tmpDir);
    expect(firstResult).toBe(true);

    const secondResult = scaffoldIfNeeded(tmpDir);
    expect(secondResult).toBe(false);
  });

  it('does NOT overwrite existing files', () => {
    // First scaffold
    scaffoldIfNeeded(tmpDir);

    // Modify the files
    const configPath = join(tmpDir, '.opencode', 'context', 'config.jsonc');
    const turnStartPath = join(tmpDir, '.opencode', 'context', 'prompts', 'turn-start.md');

    writeFileSync(configPath, 'CUSTOM CONFIG', 'utf-8');
    writeFileSync(turnStartPath, 'CUSTOM TURN START', 'utf-8');

    // Second scaffold attempt
    scaffoldIfNeeded(tmpDir);

    // Files should still have custom content
    expect(readFileSync(configPath, 'utf-8')).toBe('CUSTOM CONFIG');
    expect(readFileSync(turnStartPath, 'utf-8')).toBe('CUSTOM TURN START');
  });
});
