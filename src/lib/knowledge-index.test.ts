import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildKnowledgeIndex,
  formatKnowledgeIndex,
  scanDomains,
  detectKnowledgeMode,
  formatDomainIndex,
  buildKnowledgeIndexV2,
} from './knowledge-index';

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

describe('scanDomains', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `domain-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no INDEX.md exists in subdirectories', () => {
    const docsDir = join(tmpDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'plain.md'), '# Plain file');
    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toEqual([]);
  });

  it('discovers single domain with INDEX.md', () => {
    const archDir = join(tmpDir, 'docs', 'architecture');
    mkdirSync(archDir, { recursive: true });
    writeFileSync(join(archDir, 'INDEX.md'), '# Architecture Domain\nOverview of arch.');
    writeFileSync(join(archDir, 'adr-001.md'), '# ADR-001');
    writeFileSync(join(archDir, 'design.md'), '# Design');

    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('architecture');
    expect(result[0].path).toBe('docs/architecture');
    expect(result[0].indexContent).toContain('# Architecture Domain');
    expect(result[0].noteCount).toBe(2); // adr-001.md + design.md (excludes INDEX.md)
  });

  it('discovers multiple domains', () => {
    const archDir = join(tmpDir, 'docs', 'architecture');
    const bugsDir = join(tmpDir, 'docs', 'bugs');
    mkdirSync(archDir, { recursive: true });
    mkdirSync(bugsDir, { recursive: true });
    writeFileSync(join(archDir, 'INDEX.md'), '# Architecture');
    writeFileSync(join(bugsDir, 'INDEX.md'), '# Bugs');
    writeFileSync(join(bugsDir, 'bug-001.md'), '# Bug 001');

    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toHaveLength(2);
    const domains = result.map((d) => d.domain).sort();
    expect(domains).toEqual(['architecture', 'bugs']);
  });

  it('respects maxDomainDepth (does NOT scan beyond depth)', () => {
    // depth 1: docs/deep1/INDEX.md — should be found
    // depth 2: docs/deep1/deep2/INDEX.md — should be found (maxDepth=2)
    // depth 3: docs/deep1/deep2/deep3/INDEX.md — should NOT be found
    const d1 = join(tmpDir, 'docs', 'deep1');
    const d2 = join(d1, 'deep2');
    const d3 = join(d2, 'deep3');
    mkdirSync(d3, { recursive: true });
    writeFileSync(join(d1, 'INDEX.md'), '# Depth 1');
    writeFileSync(join(d2, 'INDEX.md'), '# Depth 2');
    writeFileSync(join(d3, 'INDEX.md'), '# Depth 3');

    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toHaveLength(2);
    const domains = result.map((d) => d.domain).sort();
    expect(domains).toEqual(['deep1', 'deep2']);
  });

  it('truncates INDEX.md content to maxIndexFileSize', () => {
    const domainDir = join(tmpDir, 'docs', 'big');
    mkdirSync(domainDir, { recursive: true });
    // Write INDEX.md larger than 32KB
    const bigContent = 'X'.repeat(40 * 1024);
    writeFileSync(join(domainDir, 'INDEX.md'), bigContent);

    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toHaveLength(1);
    expect(result[0].indexContent.length).toBeLessThanOrEqual(32 * 1024);
  });

  it('counts only .md files (excluding INDEX.md) for noteCount', () => {
    const domainDir = join(tmpDir, 'docs', 'mixed');
    mkdirSync(domainDir, { recursive: true });
    writeFileSync(join(domainDir, 'INDEX.md'), '# Mixed');
    writeFileSync(join(domainDir, 'note1.md'), '# Note 1');
    writeFileSync(join(domainDir, 'note2.md'), '# Note 2');
    writeFileSync(join(domainDir, 'data.json'), '{}'); // not .md
    writeFileSync(join(domainDir, 'readme.txt'), 'text'); // not .md

    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toHaveLength(1);
    expect(result[0].noteCount).toBe(2);
  });

  it('returns empty array for non-existent knowledge dir', () => {
    const result = scanDomains(tmpDir, 'nonexistent', 'INDEX.md', 2);
    expect(result).toEqual([]);
  });

  it('ignores subdirectories without INDEX.md', () => {
    const withIndex = join(tmpDir, 'docs', 'has-index');
    const withoutIndex = join(tmpDir, 'docs', 'no-index');
    mkdirSync(withIndex, { recursive: true });
    mkdirSync(withoutIndex, { recursive: true });
    writeFileSync(join(withIndex, 'INDEX.md'), '# Has Index');
    writeFileSync(join(withoutIndex, 'note.md'), '# Just a note');

    const result = scanDomains(tmpDir, 'docs', 'INDEX.md', 2);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('has-index');
  });
});

describe('detectKnowledgeMode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `mode-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns "flat" when mode is explicitly "flat"', () => {
    const result = detectKnowledgeMode(tmpDir, 'docs', 'INDEX.md', 'flat');
    expect(result).toBe('flat');
  });

  it('returns "domain" when mode is explicitly "domain"', () => {
    const result = detectKnowledgeMode(tmpDir, 'docs', 'INDEX.md', 'domain');
    expect(result).toBe('domain');
  });

  it('auto-detects "domain" when INDEX.md exists in subdirectory', () => {
    const archDir = join(tmpDir, 'docs', 'architecture');
    mkdirSync(archDir, { recursive: true });
    writeFileSync(join(archDir, 'INDEX.md'), '# Architecture');

    const result = detectKnowledgeMode(tmpDir, 'docs', 'INDEX.md', 'auto');
    expect(result).toBe('domain');
  });

  it('auto-detects "flat" when no INDEX.md exists', () => {
    const docsDir = join(tmpDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'plain.md'), '# Plain');

    const result = detectKnowledgeMode(tmpDir, 'docs', 'INDEX.md', 'auto');
    expect(result).toBe('flat');
  });

  it('auto-detects "flat" when knowledge dir does not exist', () => {
    const result = detectKnowledgeMode(tmpDir, 'nonexistent', 'INDEX.md', 'auto');
    expect(result).toBe('flat');
  });
});

describe('formatDomainIndex', () => {
  it('returns empty string when no domains and no individual files', () => {
    const result = formatDomainIndex({
      mode: 'domain',
      domains: [],
      individualFiles: [],
    });
    expect(result).toBe('');
  });

  it('formats domains with INDEX.md content inline', () => {
    const result = formatDomainIndex({
      mode: 'domain',
      domains: [
        {
          domain: 'architecture',
          path: 'docs/architecture',
          indexContent: '# Architecture\nSystem design docs.',
          noteCount: 3,
        },
      ],
      individualFiles: [],
    });
    expect(result).toContain('## Available Knowledge');
    expect(result).toContain('architecture');
    expect(result).toContain('# Architecture');
    expect(result).toContain('System design docs.');
    expect(result).toContain('3');
  });

  it('formats individual files separately from domains', () => {
    const result = formatDomainIndex({
      mode: 'domain',
      domains: [
        {
          domain: 'bugs',
          path: 'docs/bugs',
          indexContent: '# Bugs',
          noteCount: 1,
        },
      ],
      individualFiles: [{ filename: 'AGENTS.md', summary: '# AGENTS.md' }],
    });
    expect(result).toContain('## Available Knowledge');
    expect(result).toContain('bugs');
    expect(result).toContain('AGENTS.md');
  });

  it('renders only individual files when no domains exist', () => {
    const result = formatDomainIndex({
      mode: 'flat',
      domains: [],
      individualFiles: [
        { filename: 'README.md', summary: '# README' },
        { filename: 'AGENTS.md', summary: '# AGENTS' },
      ],
    });
    expect(result).toContain('## Available Knowledge');
    expect(result).toContain('- README.md');
    expect(result).toContain('- AGENTS.md');
  });

  it('renders only domains when no individual files exist', () => {
    const result = formatDomainIndex({
      mode: 'domain',
      domains: [
        {
          domain: 'patterns',
          path: 'docs/patterns',
          indexContent: '# Patterns\nReusable code patterns.',
          noteCount: 5,
        },
      ],
      individualFiles: [],
    });
    expect(result).toContain('## Available Knowledge');
    expect(result).toContain('patterns');
    expect(result).not.toContain('### Individual Files');
  });
});

describe('buildKnowledgeIndexV2', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `v2-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns flat mode for plain docs/ directory (backward compat)', () => {
    const docsDir = join(tmpDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'arch.md'), '# Architecture');
    writeFileSync(join(docsDir, 'guide.md'), '# Guide');

    const result = buildKnowledgeIndexV2(tmpDir, {
      dir: 'docs',
      sources: ['AGENTS.md'],
    });
    expect(result.mode).toBe('flat');
    expect(result.domains).toHaveLength(0);
    expect(result.individualFiles.length).toBeGreaterThanOrEqual(2);
  });

  it('returns domain mode when INDEX.md exists in subdirectory', () => {
    const archDir = join(tmpDir, 'docs', 'architecture');
    mkdirSync(archDir, { recursive: true });
    writeFileSync(join(archDir, 'INDEX.md'), '# Architecture Domain');
    writeFileSync(join(archDir, 'adr-001.md'), '# ADR 001');
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# AGENTS');

    const result = buildKnowledgeIndexV2(tmpDir, {
      dir: 'docs',
      sources: ['AGENTS.md'],
    });
    expect(result.mode).toBe('domain');
    expect(result.domains).toHaveLength(1);
    expect(result.domains[0].domain).toBe('architecture');
    expect(result.individualFiles).toHaveLength(1);
    expect(result.individualFiles[0].filename).toBe('AGENTS.md');
  });

  it('collects root-level .md files in docs/ as individual files in domain mode', () => {
    const archDir = join(tmpDir, 'docs', 'architecture');
    mkdirSync(archDir, { recursive: true });
    writeFileSync(join(archDir, 'INDEX.md'), '# Architecture');
    writeFileSync(join(tmpDir, 'docs', 'standalone.md'), '# Standalone note');

    const result = buildKnowledgeIndexV2(tmpDir, {
      dir: 'docs',
      sources: [],
    });
    expect(result.mode).toBe('domain');
    expect(result.domains).toHaveLength(1);
    expect(result.individualFiles.some((f) => f.filename === 'docs/standalone.md')).toBe(true);
  });

  it('respects explicit mode override (flat)', () => {
    const archDir = join(tmpDir, 'docs', 'architecture');
    mkdirSync(archDir, { recursive: true });
    writeFileSync(join(archDir, 'INDEX.md'), '# Architecture');

    const result = buildKnowledgeIndexV2(tmpDir, {
      dir: 'docs',
      sources: [],
      mode: 'flat',
    });
    expect(result.mode).toBe('flat');
    expect(result.domains).toHaveLength(0);
  });

  it('respects explicit mode override (domain) even without INDEX.md', () => {
    const docsDir = join(tmpDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'plain.md'), '# Plain');

    const result = buildKnowledgeIndexV2(tmpDir, {
      dir: 'docs',
      sources: [],
      mode: 'domain',
    });
    expect(result.mode).toBe('domain');
    expect(result.domains).toHaveLength(0);
  });
});
