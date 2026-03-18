import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from './config';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when file does not exist', () => {
    const config = loadConfig(tmpDir);

    expect(config).toBeDefined();
    expect(Object.keys(config)).toEqual(['prompts', 'knowledge']);
    expect(config.prompts).toBeDefined();
    expect(config.prompts.turnStart).toContain('.context/prompts/turn-start.md');
    expect(config.prompts.turnEnd).toContain('.context/prompts/turn-end.md');
    expect(config.knowledge).toBeDefined();
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
    expect(config.knowledge.dir).toBe('docs');
  });

  it('parses valid config.jsonc', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    const configContent = JSON.stringify({
      prompts: {
        turnStart: 'custom/start.md',
        turnEnd: 'custom/end.md',
      },
      knowledge: {
        dir: 'knowledge',
        sources: ['README.md', 'docs/guide.md'],
      },
    });
    writeFileSync(join(configDir, 'config.jsonc'), configContent);

    const config = loadConfig(tmpDir);

    expect(config.prompts.turnStart).toBe('custom/start.md');
    expect(config.prompts.turnEnd).toBe('custom/end.md');
    expect(config.knowledge.sources).toEqual(['README.md', 'docs/guide.md']);
    expect(config.knowledge.dir).toBe('knowledge');
  });

  it('parses JSONC with comments', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    const configContent = `{
      // This is a comment
      "prompts": {
        "turnStart": "custom/start.md" // inline comment
      },
      /* block comment */
      "knowledge": {
        "sources": ["README.md"]
      }
    }`;
    writeFileSync(join(configDir, 'config.jsonc'), configContent);

    const config = loadConfig(tmpDir);

    expect(config.prompts.turnStart).toBe('custom/start.md');
    expect(config.knowledge.sources).toEqual(['README.md']);
  });

  it('returns default config on malformed JSON', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    writeFileSync(join(configDir, 'config.jsonc'), '{ invalid json content }');

    const config = loadConfig(tmpDir);

    // Should return defaults, not throw
    expect(config.prompts.turnStart).toContain('.context/prompts/turn-start.md');
    expect(config.prompts.turnEnd).toContain('.context/prompts/turn-end.md');
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
    expect(config.knowledge.dir).toBe('docs');
  });

  it('merges partial config with defaults', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    const configContent = JSON.stringify({
      prompts: {
        turnStart: 'custom/start.md',
        // turnEnd is not specified
      },
      // knowledge is not specified
    });
    writeFileSync(join(configDir, 'config.jsonc'), configContent);

    const config = loadConfig(tmpDir);

    // Custom value should be used
    expect(config.prompts.turnStart).toBe('custom/start.md');
    // Default value should be used for missing field
    expect(config.prompts.turnEnd).toContain('.context/prompts/turn-end.md');
    // Default knowledge sources should be used
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
    expect(config.knowledge.dir).toBe('docs');
  });
  it('returns only turnStart and turnEnd prompt defaults', () => {
    const config = loadConfig(tmpDir);
    expect(Object.keys(config.prompts)).toEqual(['turnStart', 'turnEnd']);
  });
});

describe('loadConfig - knowledge domain fields', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `config-domain-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default values for new optional fields when not specified', () => {
    const config = loadConfig(tmpDir);
    expect(config.knowledge.mode).toBe('auto');
    expect(config.knowledge.indexFilename).toBe('INDEX.md');
    expect(config.knowledge.maxDomainDepth).toBe(2);
  });

  it('parses custom mode, indexFilename, maxDomainDepth', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    const configContent = JSON.stringify({
      knowledge: {
        dir: 'knowledge',
        sources: ['README.md'],
        mode: 'domain',
        indexFilename: '_INDEX.md',
        maxDomainDepth: 3,
      },
    });
    writeFileSync(join(configDir, 'config.jsonc'), configContent);

    const config = loadConfig(tmpDir);
    expect(config.knowledge.mode).toBe('domain');
    expect(config.knowledge.indexFilename).toBe('_INDEX.md');
    expect(config.knowledge.maxDomainDepth).toBe(3);
  });

  it('merges partial knowledge config - only mode specified', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    const configContent = JSON.stringify({
      knowledge: {
        mode: 'flat',
      },
    });
    writeFileSync(join(configDir, 'config.jsonc'), configContent);

    const config = loadConfig(tmpDir);
    expect(config.knowledge.mode).toBe('flat');
    expect(config.knowledge.indexFilename).toBe('INDEX.md');
    expect(config.knowledge.maxDomainDepth).toBe(2);
    expect(config.knowledge.dir).toBe('docs');
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
  });
});

describe('loadConfig - legacy fallback', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `config-fallback-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('falls back to .opencode/context/config.jsonc when .context/ does not exist', () => {
    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(legacyDir, { recursive: true });

    const configContent = JSON.stringify({
      prompts: {
        turnStart: 'legacy/start.md',
        turnEnd: 'legacy/end.md',
      },
      knowledge: {
        dir: 'legacy-docs',
        sources: ['LEGACY.md'],
      },
    });
    writeFileSync(join(legacyDir, 'config.jsonc'), configContent);

    const config = loadConfig(tmpDir);

    expect(config.prompts.turnStart).toBe('legacy/start.md');
    expect(config.prompts.turnEnd).toBe('legacy/end.md');
    expect(config.knowledge.dir).toBe('legacy-docs');
    expect(config.knowledge.sources).toEqual(['LEGACY.md']);
  });

  it('prefers .context/ over .opencode/context/ when both exist', () => {
    const newDir = join(tmpDir, '.context');
    mkdirSync(newDir, { recursive: true });
    writeFileSync(
      join(newDir, 'config.jsonc'),
      JSON.stringify({ prompts: { turnStart: 'new/start.md' } })
    );

    const legacyDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      join(legacyDir, 'config.jsonc'),
      JSON.stringify({ prompts: { turnStart: 'legacy/start.md' } })
    );

    const config = loadConfig(tmpDir);

    expect(config.prompts.turnStart).toBe('new/start.md');
  });
});
