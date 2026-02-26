import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scaffoldIfNeeded, updateScaffold } from './scaffold';

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
    expect(content).toContain('"dir"');
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
    expect(readFileSync(turnStartPath, 'utf-8')).toBe('CUSTOM TURN START');
  });

  it('creates .opencode/context/templates/ directory', () => {
    scaffoldIfNeeded(tmpDir);

    expect(existsSync(join(tmpDir, '.opencode', 'context', 'templates'))).toBe(true);
  });

  it('creates 8 template files in templates directory', () => {
    scaffoldIfNeeded(tmpDir);

    const templatesDir = join(tmpDir, '.opencode', 'context', 'templates');
    const expectedFiles = [
      'adr.md',
      'pattern.md',
      'bug.md',
      'gotcha.md',
      'decision.md',
      'context.md',
      'runbook.md',
      'insight.md',
    ];
    for (const file of expectedFiles) {
      expect(existsSync(join(templatesDir, file))).toBe(true);
    }
  });

  it('template files contain expected section headers', () => {
    scaffoldIfNeeded(tmpDir);

    const templatesDir = join(tmpDir, '.opencode', 'context', 'templates');

    const adr = readFileSync(join(templatesDir, 'adr.md'), 'utf-8');
    expect(adr).toContain('ADR-NNN');

    const pattern = readFileSync(join(templatesDir, 'pattern.md'), 'utf-8');
    expect(pattern).toContain('Pattern:');

    const bug = readFileSync(join(templatesDir, 'bug.md'), 'utf-8');
    expect(bug).toContain('Bug:');

    const insight = readFileSync(join(templatesDir, 'insight.md'), 'utf-8');
    expect(insight).toContain('Insight:');
  });
});

describe('updateScaffold', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `update-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates outdated files and returns their paths', () => {
    // Create scaffold first
    scaffoldIfNeeded(tmpDir);

    // Simulate outdated content by overwriting with old content
    const turnStartPath = join(tmpDir, '.opencode', 'context', 'prompts', 'turn-start.md');
    writeFileSync(turnStartPath, 'OLD CONTENT', 'utf-8');

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('prompts/turn-start.md');
    expect(readFileSync(turnStartPath, 'utf-8')).toContain('Knowledge Context');
  });

  it('returns empty array when all files are current', () => {
    scaffoldIfNeeded(tmpDir);

    const updated = updateScaffold(tmpDir);

    expect(updated).toEqual([]);
  });

  it('creates missing files', () => {
    // Create dir but no files
    mkdirSync(join(tmpDir, '.opencode', 'context', 'prompts'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toHaveLength(11); // config + turn-start + turn-end + 8 templates
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'prompts', 'turn-start.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'prompts', 'turn-end.md'))).toBe(true);
  });

  it('creates scaffold directory if it does not exist', () => {
    const updated = updateScaffold(tmpDir);

    expect(updated).toHaveLength(11);
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'prompts'))).toBe(true);
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'prompts'))).toBe(true);
  });

  it('creates templates directory', () => {
    updateScaffold(tmpDir);

    expect(existsSync(join(tmpDir, '.opencode', 'context', 'templates'))).toBe(true);
  });

  it('includes template files in updated paths', () => {
    scaffoldIfNeeded(tmpDir);

    // Simulate outdated template
    const adrPath = join(tmpDir, '.opencode', 'context', 'templates', 'adr.md');
    writeFileSync(adrPath, 'OLD CONTENT', 'utf-8');

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('templates/adr.md');
    expect(readFileSync(adrPath, 'utf-8')).toContain('ADR-NNN');
  });
});
