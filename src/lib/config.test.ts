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
    expect(config.prompts).toBeDefined();
    expect(config.prompts.turnStart).toContain('.opencode/context/prompts/turn-start.md');
    expect(config.prompts.turnEnd).toContain('.opencode/context/prompts/turn-end.md');
    expect(config.knowledge).toBeDefined();
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
    expect(config.knowledge.dir).toBe('docs');
  });

  it('parses valid config.jsonc', () => {
    const configDir = join(tmpDir, '.opencode', 'context');
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
    const configDir = join(tmpDir, '.opencode', 'context');
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
    const configDir = join(tmpDir, '.opencode', 'context');
    mkdirSync(configDir, { recursive: true });

    writeFileSync(join(configDir, 'config.jsonc'), '{ invalid json content }');

    const config = loadConfig(tmpDir);

    // Should return defaults, not throw
    expect(config.prompts.turnStart).toContain('.opencode/context/prompts/turn-start.md');
    expect(config.prompts.turnEnd).toContain('.opencode/context/prompts/turn-end.md');
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
    expect(config.knowledge.dir).toBe('docs');
  });

  it('merges partial config with defaults', () => {
    const configDir = join(tmpDir, '.opencode', 'context');
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
    expect(config.prompts.turnEnd).toContain('.opencode/context/prompts/turn-end.md');
    // Default knowledge sources should be used
    expect(config.knowledge.sources).toEqual(['AGENTS.md']);
    expect(config.knowledge.dir).toBe('docs');
  });
});
