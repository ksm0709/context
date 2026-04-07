import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureContextPluginRegistered,
  getOpenCodeConfigPath,
  readOpenCodeConfig,
} from './opencode-settings.js';

describe('opencode settings', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `opencode-settings-test-${Date.now()}-${Math.random()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates opencode.json when missing', () => {
    const changed = ensureContextPluginRegistered(tmpDir);

    expect(changed).toBe(true);
    expect(readOpenCodeConfig(tmpDir).plugin).toEqual(['@ksm0709/context']);
  });

  it('appends the plugin when plugin array already exists', () => {
    writeFileSync(
      getOpenCodeConfigPath(tmpDir),
      JSON.stringify({ plugin: ['existing-plugin'] }, null, 2),
      'utf8'
    );

    const changed = ensureContextPluginRegistered(tmpDir);

    expect(changed).toBe(true);
    expect(readOpenCodeConfig(tmpDir).plugin).toEqual(['existing-plugin', '@ksm0709/context']);
  });

  it('preserves other config keys', () => {
    writeFileSync(
      getOpenCodeConfigPath(tmpDir),
      JSON.stringify({ plugin: ['existing-plugin'], theme: 'dark' }, null, 2),
      'utf8'
    );

    ensureContextPluginRegistered(tmpDir);

    const content = JSON.parse(readFileSync(getOpenCodeConfigPath(tmpDir), 'utf8'));
    expect(content.theme).toBe('dark');
    expect(content.plugin).toEqual(['existing-plugin', '@ksm0709/context']);
  });

  it('is idempotent when the plugin is already registered', () => {
    writeFileSync(
      getOpenCodeConfigPath(tmpDir),
      JSON.stringify({ plugin: ['@ksm0709/context'] }, null, 2),
      'utf8'
    );

    const changed = ensureContextPluginRegistered(tmpDir);

    expect(changed).toBe(false);
    expect(readOpenCodeConfig(tmpDir).plugin).toEqual(['@ksm0709/context']);
  });
});
