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
    expect(existsSync(join(tmpDir, '.context', 'prompts'))).toBe(true);
  });

  it('creates config.jsonc with valid content', () => {
    scaffoldIfNeeded(tmpDir);

    const configPath = join(tmpDir, '.context', 'config.jsonc');
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('Context Plugin Configuration');
    expect(content).toContain('prompts');
    expect(content).toContain('"turnStart": "prompts/turn-start.md"');
    expect(content).toContain('"turnEnd": "prompts/turn-end.md"');
    expect(content).not.toContain('.opencode/context/prompts');
    expect(content).toContain('knowledge');
    expect(content).toContain('"dir"');
  });

  it('creates turn-start.md and turn-end.md', () => {
    scaffoldIfNeeded(tmpDir);

    const promptsDir = join(tmpDir, '.context', 'prompts');
    expect(existsSync(join(promptsDir, 'turn-start.md'))).toBe(true);
    expect(existsSync(join(promptsDir, 'turn-end.md'))).toBe(true);

    const turnStart = readFileSync(join(promptsDir, 'turn-start.md'), 'utf-8');
    expect(turnStart).toContain('Knowledge Context');
    expect(turnStart).toContain(
      '메인 에이전트가 아래 **Available Knowledge** 목록에서 현재 작업과 관련된 문서를 **직접 먼저** 읽으세요'
    );
    expect(turnStart).toContain('읽은 지식을 현재 작업의 설계, 구현, 검증에 직접 반영하세요');
    expect(turnStart).not.toContain('subagent');
    expect(turnStart).not.toContain('task(');
    expect(turnStart).not.toContain('primary-only');
    expect(turnStart).not.toContain('subagent-only');

    const turnEnd = readFileSync(join(promptsDir, 'turn-end.md'), 'utf-8');
    expect(turnEnd).toContain('8. **작업 완료**:');
    expect(turnEnd).toContain('아래 메뉴 중 하나를 선택해 진행 상황에 맞게 수행하세요.');
    expect(turnEnd).toContain('메뉴를 출력한 뒤에는 반드시 사용자의 응답을 기다리세요(STOP).');
    expect(turnEnd).toContain('반드시 링크된 가이드를 참고하여 정확히 수행해야 합니다.');
    expect(turnEnd).toContain('.context/guides/quality-check.md');
    expect(turnEnd).toContain('.context/guides/daily-note-guide.md');
    expect(turnEnd).toContain('.context/guides/note-guide.md');
    expect(turnEnd).toContain('.context/guides/complete-guide.md');
    expect(turnEnd).not.toContain('.opencode/context/templates');
    expect(turnEnd).not.toContain('subagent');
    expect(turnEnd).not.toContain('task(');
    expect(turnEnd).not.toContain('primary-only');
    expect(turnEnd).not.toContain('subagent-only');
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

  it('refreshes existing installs to the latest prompt wording through autoUpdateTemplates', async () => {
    const { scaffoldIfNeeded, autoUpdateTemplates } = await import('./scaffold.js');
    scaffoldIfNeeded(tmpDir);

    const turnEndPath = join(tmpDir, '.context', 'prompts', 'turn-end.md');
    writeFileSync(turnEndPath, 'LEGACY PROMPT WITH subagent task(', 'utf-8');
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    autoUpdateTemplates(tmpDir);
    expect(readFileSync(turnEndPath, 'utf-8')).not.toBe('LEGACY PROMPT WITH subagent task(');
    expect(readFileSync(turnEndPath, 'utf-8')).toContain('8. **작업 완료**:');
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
    const turnStartPath = join(tmpDir, '.context', 'prompts', 'turn-start.md');

    writeFileSync(configPath, 'CUSTOM CONFIG', 'utf-8');
    writeFileSync(turnStartPath, 'CUSTOM TURN START', 'utf-8');

    // Second scaffold attempt
    scaffoldIfNeeded(tmpDir);

    // Files should still have custom content
    expect(readFileSync(configPath, 'utf-8')).toBe('CUSTOM CONFIG');
    expect(readFileSync(turnStartPath, 'utf-8')).toBe('CUSTOM TURN START');
    expect(readFileSync(turnStartPath, 'utf-8')).toBe('CUSTOM TURN START');
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

  it('DEFAULT_TURN_START contains {{knowledgeDir}}', () => {
    scaffoldIfNeeded(tmpDir);
    const turnStart = readFileSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'), 'utf-8');
    expect(turnStart).toContain('{{knowledgeDir}}');
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
    const turnStartPath = join(tmpDir, '.context', 'prompts', 'turn-start.md');
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

  it('updates legacy .opencode/context when that scaffold already exists', () => {
    mkdirSync(join(tmpDir, '.opencode', 'context', 'prompts'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('config.jsonc');
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context'))).toBe(false);
  });

  it('creates missing files', () => {
    // Create dir but no files
    mkdirSync(join(tmpDir, '.context', 'prompts'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toHaveLength(20); // config + turn-start + turn-end + 10 templates + 7 guides
    expect(existsSync(join(tmpDir, '.context', 'config.jsonc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'prompts', 'turn-end.md'))).toBe(true);
  });

  it('creates scaffold directory if it does not exist', () => {
    const updated = updateScaffold(tmpDir);

    expect(updated).toHaveLength(20);
    expect(existsSync(join(tmpDir, '.context', 'prompts'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'prompts'))).toBe(true);
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

  it('does NOT update config.jsonc but updates prompts', () => {
    scaffoldIfNeeded(tmpDir);

    // Simulate older version
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    // Modify config and prompts (user customizations)
    writeFileSync(join(tmpDir, '.context', 'config.jsonc'), 'CUSTOM CONFIG', 'utf-8');
    writeFileSync(
      join(tmpDir, '.context', 'prompts', 'turn-start.md'),
      'CUSTOM TURN START',
      'utf-8'
    );

    autoUpdateTemplates(tmpDir);

    expect(readFileSync(join(tmpDir, '.context', 'config.jsonc'), 'utf-8')).toBe('CUSTOM CONFIG');
    expect(readFileSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'), 'utf-8')).not.toBe(
      'CUSTOM TURN START'
    );
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

    expect(updated).toHaveLength(19); // 10 template files + 7 guides + 2 prompts
    expect(existsSync(join(tmpDir, '.context', 'templates', 'adr.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context', 'templates', 'index.md'))).toBe(true);
  });
});

describe('updatePrompts', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates prompt files when they do not exist', async () => {
    // Import dynamically to get fresh module
    const { updatePrompts } = await import('./scaffold.js');
    const updated = updatePrompts(tmpDir);

    expect(updated).toContain('prompts/turn-start.md');
    expect(updated).toContain('prompts/turn-end.md');
    expect(updated).toHaveLength(2);

    // Verify files were actually created
    const turnStart = readFileSync(join(tmpDir, '.context', 'prompts', 'turn-start.md'), 'utf-8');
    const turnEnd = readFileSync(join(tmpDir, '.context', 'prompts', 'turn-end.md'), 'utf-8');
    expect(turnStart.length).toBeGreaterThan(0);
    expect(turnEnd.length).toBeGreaterThan(0);
  });

  it('returns empty array when prompts are already up to date', async () => {
    const { updatePrompts } = await import('./scaffold.js');
    // First call creates them
    updatePrompts(tmpDir);
    // Second call should find them up to date
    const updated = updatePrompts(tmpDir);
    expect(updated).toHaveLength(0);
  });

  it('overwrites customized prompts with defaults', async () => {
    const { updatePrompts } = await import('./scaffold.js');
    // Create scaffold first
    updatePrompts(tmpDir);

    // User customizes the prompt
    const promptPath = join(tmpDir, '.context', 'prompts', 'turn-start.md');
    writeFileSync(promptPath, 'Custom content', 'utf-8');

    // Update should overwrite
    const updated = updatePrompts(tmpDir);
    expect(updated).toContain('prompts/turn-start.md');

    const content = readFileSync(promptPath, 'utf-8');
    expect(content).not.toBe('Custom content');
    expect(content).toContain('읽은 지식을 현재 작업의 설계, 구현, 검증에 직접 반영하세요');
    expect(content).toContain(
      '메인 에이전트가 아래 **Available Knowledge** 목록에서 현재 작업과 관련된 문서를 **직접 먼저** 읽으세요'
    );
    expect(content).not.toContain('subagent');
    expect(content).not.toContain('task(');
  });

  it('refreshes existing installs to the latest prompt wording through autoUpdateTemplates', async () => {
    const { scaffoldIfNeeded, autoUpdateTemplates } = await import('./scaffold.js');
    scaffoldIfNeeded(tmpDir);

    const turnEndPath = join(tmpDir, '.context', 'prompts', 'turn-end.md');
    writeFileSync(turnEndPath, 'LEGACY PROMPT WITH subagent task(', 'utf-8');
    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    autoUpdateTemplates(tmpDir);
    expect(readFileSync(turnEndPath, 'utf-8')).not.toBe('LEGACY PROMPT WITH subagent task(');
    expect(readFileSync(turnEndPath, 'utf-8')).toContain('8. **작업 완료**:');
  });

  it('does NOT update config.jsonc or template files', async () => {
    const { scaffoldIfNeeded, updatePrompts } = await import('./scaffold.js');
    scaffoldIfNeeded(tmpDir);

    // Customize config and a template
    const configPath = join(tmpDir, '.context', 'config.jsonc');
    const templatePath = join(tmpDir, '.context', 'templates', 'adr.md');
    writeFileSync(configPath, 'custom config', 'utf-8');
    writeFileSync(templatePath, 'custom template', 'utf-8');

    updatePrompts(tmpDir);

    // Config and template should remain untouched
    expect(readFileSync(configPath, 'utf-8')).toBe('custom config');
    expect(readFileSync(templatePath, 'utf-8')).toBe('custom template');
  });

  it('does NOT update .version file', async () => {
    const { scaffoldIfNeeded, updatePrompts, getStoredVersion } = await import('./scaffold.js');
    scaffoldIfNeeded(tmpDir);

    // Manually change version
    const versionPath = join(tmpDir, '.context', '.version');
    writeFileSync(versionPath, '0.0.1', 'utf-8');

    updatePrompts(tmpDir);

    // Version should remain unchanged
    expect(getStoredVersion(tmpDir)).toBe('0.0.1');
  });
});
