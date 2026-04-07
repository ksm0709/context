import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerOpenCodeMcp,
  removeOpenCodePlugin,
  readOpenCodeGlobalConfig,
} from './opencode-global-settings.js';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: vi.fn(() => actual.tmpdir()),
  };
});

import { homedir } from 'node:os';

describe('opencode-global-settings', () => {
  let tmpDir: string;
  let mockHome: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `opencode-global-settings-test-${Date.now()}-${Math.random()}`);
    mkdirSync(tmpDir, { recursive: true });
    mockHome = tmpdir();
    vi.mocked(homedir).mockReturnValue(mockHome);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('registerOpenCodeMcp', () => {
    it('creates config file with mcp entry when missing', () => {
      const configDir = join(mockHome, '.config', 'opencode');
      mkdirSync(configDir, { recursive: true });

      registerOpenCodeMcp(['/usr/local/bin/bun', '/path/to/mcp.js']);

      const config = readOpenCodeGlobalConfig();
      expect(config.mcp?.['context-mcp']).toEqual({
        type: 'local',
        command: ['/usr/local/bin/bun', '/path/to/mcp.js'],
      });
    });

    it('preserves existing mcp entries when adding context-mcp', () => {
      const configDir = join(mockHome, '.config', 'opencode');
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, 'opencode.json');
      writeFileSync(
        configPath,
        JSON.stringify({ mcp: { other: { type: 'remote', url: 'https://example.com' } } }, null, 2),
        'utf8'
      );

      registerOpenCodeMcp(['/usr/local/bin/bun', '/path/to/mcp.js']);

      const config = readOpenCodeGlobalConfig();
      expect(config.mcp?.['other']).toBeDefined();
      expect(config.mcp?.['context-mcp']).toBeDefined();
    });

    it('overwrites existing context-mcp entry', () => {
      const configDir = join(mockHome, '.config', 'opencode');
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, 'opencode.json');
      writeFileSync(
        configPath,
        JSON.stringify({ mcp: { 'context-mcp': { type: 'local', command: ['old'] } } }, null, 2),
        'utf8'
      );

      registerOpenCodeMcp(['/usr/local/bin/bun', '/path/to/mcp.js']);

      const config = readOpenCodeGlobalConfig();
      expect(config.mcp?.['context-mcp']?.command).toEqual(['/usr/local/bin/bun', '/path/to/mcp.js']);
    });
  });

  describe('removeOpenCodePlugin', () => {
    it('removes the plugin from the plugin array', () => {
      const configDir = join(mockHome, '.config', 'opencode');
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, 'opencode.json');
      writeFileSync(
        configPath,
        JSON.stringify({ plugin: ['@ksm0709/context', 'other-plugin'] }, null, 2),
        'utf8'
      );

      removeOpenCodePlugin('@ksm0709/context');

      const config = readOpenCodeGlobalConfig();
      expect(config.plugin).toEqual(['other-plugin']);
    });

    it('is a no-op when plugin is not in the list', () => {
      const configDir = join(mockHome, '.config', 'opencode');
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, 'opencode.json');
      const original = JSON.stringify({ plugin: ['other-plugin'] }, null, 2);
      writeFileSync(configPath, original, 'utf8');

      removeOpenCodePlugin('@ksm0709/context');

      const content = readFileSync(configPath, 'utf8');
      expect(content).toBe(original);
    });

    it('is a no-op when no plugin array exists', () => {
      const configDir = join(mockHome, '.config', 'opencode');
      mkdirSync(configDir, { recursive: true });
      const configPath = join(configDir, 'opencode.json');
      writeFileSync(configPath, JSON.stringify({ mcp: {} }, null, 2), 'utf8');

      removeOpenCodePlugin('@ksm0709/context');

      const config = readOpenCodeGlobalConfig();
      expect(config.plugin).toBeUndefined();
    });
  });
});
