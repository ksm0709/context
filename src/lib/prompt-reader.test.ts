import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readPromptFile, resolvePromptVariables } from './prompt-reader';

describe('readPromptFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `pr-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns file content for existing file', () => {
    const filePath = join(tmpDir, 'test.md');
    const content = '# Hello World\n\nThis is a test prompt.';
    writeFileSync(filePath, content, 'utf-8');

    const result = readPromptFile(filePath);

    expect(result).toBe(content);
  });

  it('returns empty string when file does not exist', () => {
    const filePath = join(tmpDir, 'non-existent.md');

    const result = readPromptFile(filePath);

    expect(result).toBe('');
  });

  it('truncates content exceeding 64KB', () => {
    const filePath = join(tmpDir, 'large.md');
    const largeContent = 'x'.repeat(65537); // 64KB + 1 byte
    writeFileSync(filePath, largeContent, 'utf-8');

    const result = readPromptFile(filePath);

    expect(result.length).toBe(65536);
    expect(result).toBe(largeContent.slice(0, 65536));
  });

  it('reads UTF-8 content correctly', () => {
    const filePath = join(tmpDir, 'utf8.md');
    const content = '# 안녕하세요\n\n日本語テスト\n\n🎉 Emoji test 🚀';
    writeFileSync(filePath, content, 'utf-8');

    const result = readPromptFile(filePath);

    expect(result).toBe(content);
  });
});

describe('resolvePromptVariables', () => {
  it('replaces {{knowledgeDir}} with provided value', () => {
    const content = 'Read files from {{knowledgeDir}}/architecture.md';
    const result = resolvePromptVariables(content, { knowledgeDir: 'docs' });
    expect(result).toBe('Read files from docs/architecture.md');
  });

  it('replaces multiple {{knowledgeDir}} placeholders in same string', () => {
    const content = '{{knowledgeDir}}/a.md and {{knowledgeDir}}/b.md';
    const result = resolvePromptVariables(content, { knowledgeDir: 'notes' });
    expect(result).toBe('notes/a.md and notes/b.md');
  });

  it('returns string unchanged when no placeholders', () => {
    const content = 'Plain text without variables';
    const result = resolvePromptVariables(content, { knowledgeDir: 'docs' });
    expect(result).toBe('Plain text without variables');
  });

  it('returns empty string for empty input', () => {
    const result = resolvePromptVariables('', { knowledgeDir: 'docs' });
    expect(result).toBe('');
  });

  it('uses docs fallback when knowledgeDir is empty string', () => {
    const content = 'Path: {{knowledgeDir}}/file.md';
    const result = resolvePromptVariables(content, { knowledgeDir: '' });
    expect(result).toBe('Path: docs/file.md');
  });

  it('removes trailing slash from knowledgeDir', () => {
    const content = '{{knowledgeDir}}/file.md';
    const result = resolvePromptVariables(content, { knowledgeDir: 'notes/' });
    expect(result).toBe('notes/file.md');
  });

  it('normalizes backslashes to forward slashes', () => {
    const content = '{{knowledgeDir}}/file.md';
    const result = resolvePromptVariables(content, { knowledgeDir: 'path\\to\\notes' });
    expect(result).toBe('path/to/notes/file.md');
  });
});
