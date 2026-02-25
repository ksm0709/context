import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildKnowledgeIndex, formatKnowledgeIndex } from './knowledge-index';

describe('buildKnowledgeIndex', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ki-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array for non-existent source', () => {
    const result = buildKnowledgeIndex(tmpDir, ['non-existent.md']);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty directory', () => {
    const emptyDir = join(tmpDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    const result = buildKnowledgeIndex(tmpDir, ['empty']);
    expect(result).toEqual([]);
  });

  it('scans single .md file and returns entry with filename + summary', () => {
    writeFileSync(join(tmpDir, 'test.md'), '# Test Title\nSome content here');
    const result = buildKnowledgeIndex(tmpDir, ['test.md']);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('test.md');
    expect(result[0].summary).toBe('# Test Title');
  });

  it('ignores non-.md files (.txt, .jpg, .png)', () => {
    writeFileSync(join(tmpDir, 'doc.md'), '# Markdown doc');
    writeFileSync(join(tmpDir, 'doc.txt'), 'Text doc');
    writeFileSync(join(tmpDir, 'img.jpg'), 'binary');
    writeFileSync(join(tmpDir, 'img.png'), 'binary');
    const result = buildKnowledgeIndex(tmpDir, ['doc.md', 'doc.txt', 'img.jpg', 'img.png']);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('doc.md');
  });

  it('scans directory recursively up to depth 3', () => {
    // Create nested structure: level1/level2/level3/doc.md
    const level1 = join(tmpDir, 'level1');
    const level2 = join(level1, 'level2');
    const level3 = join(level2, 'level3');
    mkdirSync(level3, { recursive: true });
    writeFileSync(join(level3, 'deep.md'), '# Deep File');
    const result = buildKnowledgeIndex(tmpDir, ['level1']);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('level1/level2/level3/deep.md');
  });

  it('does NOT scan beyond depth 3', () => {
    // Create nested structure: level1/level2/level3/level4/doc.md
    const level1 = join(tmpDir, 'level1');
    const level2 = join(level1, 'level2');
    const level3 = join(level2, 'level3');
    const level4 = join(level3, 'level4');
    mkdirSync(level4, { recursive: true });
    writeFileSync(join(level4, 'too-deep.md'), '# Too Deep');
    const result = buildKnowledgeIndex(tmpDir, ['level1']);
    expect(result).toHaveLength(0);
  });

  it('truncates summary to 100 chars', () => {
    const longTitle = 'A'.repeat(150);
    writeFileSync(join(tmpDir, 'long.md'), `${longTitle}\ncontent`);
    const result = buildKnowledgeIndex(tmpDir, ['long.md']);
    expect(result).toHaveLength(1);
    expect(result[0].summary.length).toBe(100);
    expect(result[0].summary).toBe('A'.repeat(100));
  });

  it('skips empty first lines and finds first non-empty line', () => {
    writeFileSync(join(tmpDir, 'skip-empty.md'), '\n\n\n# Actual Title\nSome content');
    const result = buildKnowledgeIndex(tmpDir, ['skip-empty.md']);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('# Actual Title');
  });

  it('limits entries to maxIndexEntries (100)', () => {
    // Create 105 .md files
    for (let i = 0; i < 105; i++) {
      writeFileSync(join(tmpDir, `file-${i}.md`), `# File ${i}`);
    }
    const sources: string[] = [];
    for (let i = 0; i < 105; i++) {
      sources.push(`file-${i}.md`);
    }
    const result = buildKnowledgeIndex(tmpDir, sources);
    expect(result.length).toBeLessThanOrEqual(100);
  });
});

describe('formatKnowledgeIndex', () => {
  it('formats entries as markdown list', () => {
    const entries = [
      { filename: 'doc1.md', summary: 'First doc' },
      { filename: 'doc2.md', summary: 'Second doc' },
    ];
    const result = formatKnowledgeIndex(entries);
    expect(result).toContain('## Available Knowledge');
    expect(result).toContain('- doc1.md — First doc');
    expect(result).toContain('- doc2.md — Second doc');
  });

  it('returns empty string for empty entries', () => {
    const result = formatKnowledgeIndex([]);
    expect(result).toBe('');
  });

  it('handles entries without summary', () => {
    const entries = [{ filename: 'no-summary.md', summary: '' }];
    const result = formatKnowledgeIndex(entries);
    expect(result).toContain('- no-summary.md');
    expect(result).not.toContain('—');
  });
});
