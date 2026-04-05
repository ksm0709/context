import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from './config';

describe('loadConfig - defaults', () => {
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
    expect(config.checks).toEqual([]);
    expect(config.smokeChecks).toEqual([]);
    expect(config.omx?.turnEnd?.strategy).toBe('turn-complete-sendkeys');
    expect(config.omc?.turnEnd?.strategy).toBe('stop-hook');
  });

  it('default config has no knowledge field', () => {
    const config = loadConfig(tmpDir);
    expect(config).not.toHaveProperty('knowledge');
  });

  it('returns default config on malformed JSON', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.jsonc'), '{ invalid json }');
    const config = loadConfig(tmpDir);
    expect(config.checks).toEqual([]);
    expect(config.smokeChecks).toEqual([]);
  });
});

describe('loadConfig - checks and smokeChecks', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-checks-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses checks and smokeChecks arrays from config', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.checks).toHaveLength(1);
    expect(config.checks![0].name).toBe('tests');
    expect(config.checks![0].signal).toBe('.context/.check-tests-passed');
    expect(config.smokeChecks).toHaveLength(1);
    expect(config.smokeChecks![0].command).toBe('npm test');
  });

  it('throws when smokeChecks entry has no matching checks entry by name', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        checks: [{ name: 'lint', signal: '.context/.check-lint-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      })
    );
    expect(() => loadConfig(tmpDir)).toThrow('Config error:');
    expect(() => loadConfig(tmpDir)).toThrow('"tests"');
  });

  it('throws when checks signal path is outside .context/', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        checks: [{ name: 'tests', signal: '/tmp/evil-signal' }],
        smokeChecks: [],
      })
    );
    expect(() => loadConfig(tmpDir)).toThrow('Config error:');
    expect(() => loadConfig(tmpDir)).toThrow('.context/');
  });

  it('throws when smokeChecks signal path is outside .context/', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [{ name: 'tests', command: 'npm test', signal: '../escape' }],
      })
    );
    expect(() => loadConfig(tmpDir)).toThrow('Config error:');
  });

  it('parses JSONC with comments', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      `{
        // checks for quality gate
        "checks": [{ "name": "tests", "signal": ".context/.check-tests-passed" }],
        /* smoke checks run on each stop */
        "smokeChecks": [{ "name": "tests", "command": "npm test", "signal": ".context/.check-tests-passed" }]
      }`
    );
    const config = loadConfig(tmpDir);
    expect(config.checks).toHaveLength(1);
    expect(config.smokeChecks).toHaveLength(1);
  });
});

describe('loadConfig - OMX/OMC strategy', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-strategy-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses custom OMX turn-end strategy', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({ omx: { turnEnd: { strategy: 'turn-complete-sendkeys' } } })
    );
    const config = loadConfig(tmpDir);
    expect(config.omx?.turnEnd?.strategy).toBe('turn-complete-sendkeys');
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
    writeFileSync(
      join(legacyDir, 'config.jsonc'),
      JSON.stringify({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.checks).toHaveLength(1);
  });
});
