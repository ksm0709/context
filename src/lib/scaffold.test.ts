import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  scaffoldIfNeeded,
  updateScaffold,
  getStoredVersion,
  autoUpdateTemplates,
} from './scaffold';
import pkg from '../../package.json';

describe('scaffoldIfNeeded', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .context/ directory structure when not exists', () => {
    const result = scaffoldIfNeeded(tmpDir);

    expect(result).toBe(true);
    expect(existsSync(join(tmpDir, '.context'))).toBe(true);
  });

  it('creates config.jsonc with valid content', () => {
    scaffoldIfNeeded(tmpDir);

    const configPath = join(tmpDir, '.context', 'config.jsonc');
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('Context Plugin Configuration');
    expect(content).not.toContain('.opencode/context/prompts');
    expect(content).toContain('knowledge');
    expect(content).toContain('"dir"');
  });

  it('creates guide files with correct content', () => {
    scaffoldIfNeeded(tmpDir);
    const guidesDir = join(tmpDir, '.context', 'guides');
    const dailyNoteGuide = readFileSync(join(guidesDir, 'daily-note-guide.md'), 'utf-8');
    expect(dailyNoteGuide).toContain('오늘 완료한 핵심 작업 요약');
    const noteGuide = readFileSync(join(guidesDir, 'note-guide.md'), 'utf-8');
    expect(noteGuide).toContain('제텔카스텐(Zettelkasten) 3대 원칙');
    expect(noteGuide).toContain('기록 대상 판단 기준:');
    expect(noteGuide).toContain('| 상황 | 템플릿 | 파일명 패턴 |');
    const completeGuide = readFileSync(join(guidesDir, 'complete-guide.md'), 'utf-8');
    expect(completeGuide).toContain('프롬프트 주입 루프를 종료시키는 트리거');
  });

  it('returns true on first scaffold, false when already exists (idempotent)', () => {
    const firstResult = scaffoldIfNeeded(tmpDir);
    expect(firstResult).toBe(true);

    const secondResult = scaffoldIfNeeded(tmpDir);
    expect(secondResult).toBe(false);
  });

  it('uses legacy .opencode/context when it already exists', () => {
    mkdirSync(join(tmpDir, '.opencode', 'context'), { recursive: true });

    const result = scaffoldIfNeeded(tmpDir);

    expect(result).toBe(false);
    expect(existsSync(join(tmpDir, '.context'))).toBe(false);
    expect(existsSync(join(tmpDir, '.opencode', 'context'))).toBe(true);
  });

  it('does NOT overwrite existing files', () => {
    // First scaffold
    scaffoldIfNeeded(tmpDir);

    // Modify the files
    const configPath = join(tmpDir, '.context', 'config.jsonc');

    writeFileSync(configPath, 'CUSTOM CONFIG', 'utf-8');

    // Second scaffold attempt
    scaffoldIfNeeded(tmpDir);

    // Files should still have custom content
    expect(readFileSync(configPath, 'utf-8')).toBe('CUSTOM CONFIG');
  });

  it('creates .context/templates/ directory', () => {
    scaffoldIfNeeded(tmpDir);

    expect(existsSync(join(tmpDir, '.context', 'templates'))).toBe(true);
  });

  it('creates .context/guides/ directory', () => {
    scaffoldIfNeeded(tmpDir);

    expect(existsSync(join(tmpDir, '.context', 'guides'))).toBe(true);
  });

  it('creates 10 template files in templates directory', () => {
    scaffoldIfNeeded(tmpDir);

    const templatesDir = join(tmpDir, '.context', 'templates');
    const expectedFiles = [
      'adr.md',
      'pattern.md',
      'bug.md',
      'gotcha.md',
      'decision.md',
      'context.md',
      'runbook.md',
      'insight.md',
      'index.md',
      'work-complete.txt',
    ];
    for (const file of expectedFiles) {
      expect(existsSync(join(templatesDir, file))).toBe(true);
    }
  });

  it('creates 7 guide files in guides directory', () => {
    scaffoldIfNeeded(tmpDir);

    const guidesDir = join(tmpDir, '.context', 'guides');
    const expectedFiles = [
      'daily-note-guide.md',
      'note-guide.md',
      'search-guide.md',
      'quality-check.md',
      'scope-review.md',
      'commit-guide.md',
      'complete-guide.md',
    ];
    for (const file of expectedFiles) {
      expect(existsSync(join(guidesDir, file))).toBe(true);
    }
  });

  it('template files contain expected section headers', () => {
    scaffoldIfNeeded(tmpDir);

    const templatesDir = join(tmpDir, '.context', 'templates');

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
    const adrPath = join(tmpDir, '.context', 'templates', 'adr.md');
    writeFileSync(adrPath, 'OLD CONTENT', 'utf-8');

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('templates/adr.md');
    expect(readFileSync(adrPath, 'utf-8')).toContain('ADR-NNN');
  });

  it('returns empty array when all files are current', () => {
    scaffoldIfNeeded(tmpDir);

    const updated = updateScaffold(tmpDir);

    expect(updated).toEqual([]);
  });

  it('updates legacy .opencode/context when that scaffold already exists', () => {
    mkdirSync(join(tmpDir, '.opencode', 'context', 'prompts'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('config.jsonc');
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context'))).toBe(false);
  });

  it('creates missing files', () => {
    // Create dir but no files
    mkdirSync(join(tmpDir, '.context', 'templates'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toHaveLength(18); // config + 10 templates + 7 guides
    expect(existsSync(join(tmpDir, '.context', 'config.jsonc'))).toBe(true);
  });

  it('creates scaffold directory if it does not exist', () => {
    const updated = updateScaffold(tmpDir);

    expect(updated).toHaveLength(18);
    expect(existsSync(join(tmpDir, '.context', 'templates'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'guides'))).toBe(true);
  });

  it('creates templates directory', () => {
    updateScaffold(tmpDir);

    expect(existsSync(join(tmpDir, '.context', 'templates'))).toBe(true);
  });

  it('creates guides directory', () => {
    updateScaffold(tmpDir);

    expect(existsSync(join(tmpDir, '.context', 'guides'))).toBe(true);
  });

  it('includes template files in updated paths', () => {
    scaffoldIfNeeded(tmpDir);

    // Simulate outdated template
    const adrPath = join(tmpDir, '.context', 'templates', 'adr.md');
    writeFileSync(adrPath, 'OLD CONTENT', 'utf-8');

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('templates/adr.md');
    expect(readFileSync(adrPath, 'utf-8')).toContain('ADR-NNN');
  });
});

describe('version tracking', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `version-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scaffoldIfNeeded writes version file', () => {
    scaffoldIfNeeded(tmpDir);

    const version = getStoredVersion(tmpDir);
    expect(version).toBe(pkg.version);
  });

  it('updateScaffold writes version file', () => {
    scaffoldIfNeeded(tmpDir);

    // Clear version to simulate upgrade
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.0', 'utf-8');

    updateScaffold(tmpDir);

    expect(getStoredVersion(tmpDir)).toBe(pkg.version);
  });

  it('getStoredVersion returns null when file is missing', () => {
    expect(getStoredVersion(tmpDir)).toBeNull();
  });

  it('getStoredVersion reads stored version', () => {
    mkdirSync(join(tmpDir, '.context'), { recursive: true });
    writeFileSync(join(tmpDir, '.context', '.version'), '1.2.3', 'utf-8');

    expect(getStoredVersion(tmpDir)).toBe('1.2.3');
  });
});

describe('autoUpdateTemplates', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `auto-update-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips when no scaffold directory exists', () => {
    const updated = autoUpdateTemplates(tmpDir);

    expect(updated).toEqual([]);
  });

  it('skips when stored version matches current', () => {
    scaffoldIfNeeded(tmpDir);

    const updated = autoUpdateTemplates(tmpDir);

    expect(updated).toEqual([]);
  });

  it('updates legacy templates when only .opencode/context exists', () => {
    mkdirSync(join(tmpDir, '.opencode', 'context', 'templates'), { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', '.version'), '0.0.1', 'utf-8');

    const updated = autoUpdateTemplates(tmpDir);

    expect(updated).toContain('templates/adr.md');
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'templates', 'adr.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context'))).toBe(false);
  });

  it('updates templates when version differs', () => {
    scaffoldIfNeeded(tmpDir);

    // Simulate older version
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    // Simulate outdated template
    writeFileSync(join(tmpDir, '.context', 'templates', 'adr.md'), 'OLD CONTENT', 'utf-8');

    const updated = autoUpdateTemplates(tmpDir);

    expect(updated).toContain('templates/adr.md');
    expect(readFileSync(join(tmpDir, '.context', 'templates', 'adr.md'), 'utf-8')).toContain(
      'ADR-NNN'
    );
  });

  it('does NOT update config.jsonc', () => {
    scaffoldIfNeeded(tmpDir);

    // Simulate older version
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    // Modify config (user customizations)
    writeFileSync(join(tmpDir, '.context', 'config.jsonc'), 'CUSTOM CONFIG', 'utf-8');

    autoUpdateTemplates(tmpDir);

    expect(readFileSync(join(tmpDir, '.context', 'config.jsonc'), 'utf-8')).toBe('CUSTOM CONFIG');
  });

  it('writes current version after update', () => {
    scaffoldIfNeeded(tmpDir);

    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    autoUpdateTemplates(tmpDir);

    expect(getStoredVersion(tmpDir)).toBe(pkg.version);
  });

  it('updates when version file is missing (pre-version installs)', () => {
    // Simulate scaffold without version file (old installs)
    mkdirSync(join(tmpDir, '.context', 'templates'), { recursive: true });
    mkdirSync(join(tmpDir, '.context', 'prompts'), { recursive: true });
    writeFileSync(join(tmpDir, '.context', 'templates', 'adr.md'), 'OLD CONTENT', 'utf-8');

    const updated = autoUpdateTemplates(tmpDir);

    expect(updated).toContain('templates/adr.md');
    expect(getStoredVersion(tmpDir)).toBe(pkg.version);
  });

  it('creates missing template files', () => {
    // Simulate scaffold with missing templates
    mkdirSync(join(tmpDir, '.context', 'templates'), { recursive: true });
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    const updated = autoUpdateTemplates(tmpDir);

    expect(updated).toHaveLength(17); // 10 template files + 7 guides
    expect(existsSync(join(tmpDir, '.context', 'templates', 'adr.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'templates', 'index.md'))).toBe(true);
  });
});
