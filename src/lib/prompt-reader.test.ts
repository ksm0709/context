import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readPromptFile } from './prompt-reader';

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
