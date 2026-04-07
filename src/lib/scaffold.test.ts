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
    expect(content).toContain('codex');
  });

  it('does not create templates or guides directories', () => {
    scaffoldIfNeeded(tmpDir);

    expect(existsSync(join(tmpDir, '.context', 'templates'))).toBe(false);
    expect(existsSync(join(tmpDir, '.context', 'guides'))).toBe(false);
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
    scaffoldIfNeeded(tmpDir);

    const configPath = join(tmpDir, '.context', 'config.jsonc');
    writeFileSync(configPath, 'CUSTOM CONFIG', 'utf-8');

    scaffoldIfNeeded(tmpDir);

    expect(readFileSync(configPath, 'utf-8')).toBe('CUSTOM CONFIG');
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

  it('returns empty array when all files are current', () => {
    scaffoldIfNeeded(tmpDir);

    const updated = updateScaffold(tmpDir);

    expect(updated).toEqual([]);
  });

  it('updates legacy .opencode/context when that scaffold already exists', () => {
    mkdirSync(join(tmpDir, '.opencode', 'context'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('config.jsonc');
    expect(existsSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'))).toBe(true);
    expect(existsSync(join(tmpDir, '.context'))).toBe(false);
  });

  it('creates missing config file', () => {
    mkdirSync(join(tmpDir, '.context'), { recursive: true });

    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('config.jsonc');
    expect(existsSync(join(tmpDir, '.context', 'config.jsonc'))).toBe(true);
  });

  it('creates scaffold directory if it does not exist', () => {
    const updated = updateScaffold(tmpDir);

    expect(updated).toContain('config.jsonc');
    expect(existsSync(join(tmpDir, '.context', 'config.jsonc'))).toBe(true);
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

  it('writes current version when version differs', () => {
    scaffoldIfNeeded(tmpDir);

    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');

    autoUpdateTemplates(tmpDir);

    expect(getStoredVersion(tmpDir)).toBe(pkg.version);
  });

  it('does NOT update config.jsonc', () => {
    scaffoldIfNeeded(tmpDir);

    writeFileSync(join(tmpDir, '.context', '.version'), '0.0.1', 'utf-8');
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
});
