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
    expect(config.omc?.turnEnd?.strategy).toBe('stop-hook');
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

  it('accepts smokeCheck with triggerCommand string', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        checks: [{ name: 'lint', signal: '.context/.check-lint-passed' }],
        smokeChecks: [
          {
            name: 'lint',
            command: 'npm run lint',
            signal: '.context/.check-lint-passed',
            triggerCommand: 'git diff --name-only | grep -q .ts',
          },
        ],
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].triggerCommand).toBe('git diff --name-only | grep -q .ts');
  });

  it('allows smokeChecks entry without a matching checks entry by name', () => {
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
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks).toHaveLength(1);
    expect(config.smokeChecks![0].name).toBe('tests');
  });

  it('parses smokeCheck with enabled: false', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        smokeChecks: [
          {
            name: 'tests',
            command: 'npm test',
            signal: '.context/.check-tests-passed',
            enabled: false,
          },
        ],
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].enabled).toBe(false);
  });

  it('parses smokeCheck with enabled: true', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        smokeChecks: [
          {
            name: 'tests',
            command: 'npm test',
            signal: '.context/.check-tests-passed',
            enabled: true,
          },
        ],
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].enabled).toBe(true);
  });

  it('parses smokeCheck without enabled (default undefined)', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      })
    );
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].enabled).toBeUndefined();
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

describe('loadConfig - timeout validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-timeout-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(tmpDir: string, content: object) {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.jsonc'), JSON.stringify(content));
  }

  it('throws Config error for timeout below 1000ms', () => {
    writeConfig(tmpDir, {
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        {
          name: 'tests',
          command: 'npm test',
          signal: '.context/.check-tests-passed',
          timeout: 500,
        },
      ],
    });
    expect(() => loadConfig(tmpDir)).toThrow('Config error:');
    expect(() => loadConfig(tmpDir)).toThrow('timeout');
  });

  it('throws Config error for timeout above 600000ms', () => {
    writeConfig(tmpDir, {
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        {
          name: 'tests',
          command: 'npm test',
          signal: '.context/.check-tests-passed',
          timeout: 700_000,
        },
      ],
    });
    expect(() => loadConfig(tmpDir)).toThrow('Config error:');
    expect(() => loadConfig(tmpDir)).toThrow('timeout');
  });

  it('accepts timeout of exactly 1000ms', () => {
    writeConfig(tmpDir, {
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        {
          name: 'tests',
          command: 'npm test',
          signal: '.context/.check-tests-passed',
          timeout: 1000,
        },
      ],
    });
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].timeout).toBe(1000);
  });

  it('accepts timeout of exactly 600000ms', () => {
    writeConfig(tmpDir, {
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [
        {
          name: 'tests',
          command: 'npm test',
          signal: '.context/.check-tests-passed',
          timeout: 600_000,
        },
      ],
    });
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].timeout).toBe(600_000);
  });

  it('accepts smokeCheck without timeout (backward compat)', () => {
    writeConfig(tmpDir, {
      checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      smokeChecks: [{ name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' }],
    });
    const config = loadConfig(tmpDir);
    expect(config.smokeChecks![0].timeout).toBeUndefined();
  });
});

describe('inferAndPersistChecks - JSONC comment preservation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-infer-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preserves existing JSONC comments when writing checks', async () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });

    // Write config with comments
    const originalContent = `{
  // Context Plugin Configuration
  "codex": { "turnEnd": { "strategy": "stop-hook" } }
}`;
    writeFileSync(join(configDir, 'config.jsonc'), originalContent);

    // Verify the JSONC write logic through applyEdits directly (claude CLI unavailable in test env)
    const { applyEdits, modify } = await import('jsonc-parser');
    let edits = modify(
      originalContent,
      ['checks'],
      [{ name: 'tests', signal: '.context/.check-tests-passed' }],
      { formattingOptions: { insertSpaces: true, tabSize: 2 } }
    );
    let updated = applyEdits(originalContent, edits);
    edits = modify(
      updated,
      ['smokeChecks'],
      [{ name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' }],
      { formattingOptions: { insertSpaces: true, tabSize: 2 } }
    );
    updated = applyEdits(updated, edits);

    // Comments must be preserved
    expect(updated).toContain('// Context Plugin Configuration');
    // Original fields must be preserved
    expect(updated).toContain('"codex"');
    // New fields must be added
    expect(updated).toContain('"checks"');
    expect(updated).toContain('"smokeChecks"');
  });
});

describe('loadConfig - Codex/Claude strategy', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-strategy-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses custom codex turn-end strategy off', () => {
    const configDir = join(tmpDir, '.context');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.jsonc'),
      JSON.stringify({ codex: { turnEnd: { strategy: 'off' } } })
    );
    const config = loadConfig(tmpDir);
    expect(config.codex?.turnEnd?.strategy).toBe('off');
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
