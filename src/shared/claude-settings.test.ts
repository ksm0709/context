import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasContextMcpServer,
  normalizeContextMcpServer,
  setSettingsPath,
  readClaudeSettings,
  writeClaudeSettings,
  registerMcpServer,
  removeMcpServer,
  registerHook,
  removeHook,
  type McpServerEntry,
  type HookRule,
} from './claude-settings.js';

let tmpDir: string;

function setupTmpSettings(filename = 'settings.json'): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'claude-settings-test-'));
  const path = join(tmpDir, filename);
  setSettingsPath(path);
  return path;
}

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('readClaudeSettings', () => {
  it('returns {} when settings.json does not exist', () => {
    setupTmpSettings();
    expect(readClaudeSettings()).toEqual({});
  });

  it('reads existing settings', () => {
    const path = setupTmpSettings();
    writeFileSync(path, JSON.stringify({ mcpServers: { foo: { command: 'bar', args: [] } } }));
    const settings = readClaudeSettings();
    expect(settings.mcpServers?.foo.command).toBe('bar');
  });
});

describe('writeClaudeSettings', () => {
  it('creates file with correct JSON when file does not exist', () => {
    const path = setupTmpSettings();
    writeClaudeSettings({ mcpServers: { test: { command: 'node', args: ['index.js'] } } });
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.mcpServers.test.command).toBe('node');
  });

  it('preserves JSONC comments after write', () => {
    const path = setupTmpSettings();
    const original = `{
  // this is a comment
  "mcpServers": {}
}`;
    writeFileSync(path, original);
    writeClaudeSettings({ mcpServers: { foo: { command: 'bar', args: [] } } });
    const updated = readFileSync(path, 'utf8');
    expect(updated).toContain('// this is a comment');
    expect(updated).toContain('"foo"');
  });

  it('creates parent directory if missing', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'claude-settings-test-'));
    const nestedPath = join(tmpDir, 'nested', 'dir', 'settings.json');
    setSettingsPath(nestedPath);
    writeClaudeSettings({ mcpServers: {} });
    expect(existsSync(nestedPath)).toBe(true);
  });
});

describe('registerMcpServer', () => {
  it('adds a new MCP server entry', () => {
    setupTmpSettings();
    const entry: McpServerEntry = { command: 'node', args: ['server.js'] };
    registerMcpServer('my-server', entry);
    const settings = readClaudeSettings();
    expect(settings.mcpServers?.['my-server']).toEqual(entry);
  });

  it('is idempotent — calling twice does not duplicate', () => {
    setupTmpSettings();
    const entry: McpServerEntry = { command: 'node', args: ['server.js'] };
    registerMcpServer('my-server', entry);
    registerMcpServer('my-server', entry);
    const settings = readClaudeSettings();
    expect(Object.keys(settings.mcpServers ?? {})).toHaveLength(1);
  });

  it('overwrites existing entry with same name', () => {
    setupTmpSettings();
    registerMcpServer('srv', { command: 'old', args: [] });
    registerMcpServer('srv', { command: 'new', args: ['--flag'] });
    const settings = readClaudeSettings();
    expect(settings.mcpServers?.['srv'].command).toBe('new');
  });
});

describe('hasContextMcpServer', () => {
  it('returns true for the canonical context-mcp entry', () => {
    expect(
      hasContextMcpServer({ mcpServers: { 'context-mcp': { command: 'bun', args: [] } } })
    ).toBe(true);
  });

  it('returns true for the legacy context_mcp entry', () => {
    expect(hasContextMcpServer({ mcpServers: { context_mcp: { command: 'bun', args: [] } } })).toBe(
      true
    );
  });

  it('returns false when neither context MCP entry exists', () => {
    expect(hasContextMcpServer({ mcpServers: { other: { command: 'bun', args: [] } } })).toBe(
      false
    );
  });
});

describe('removeMcpServer', () => {
  it('removes an existing MCP server', () => {
    setupTmpSettings();
    registerMcpServer('to-remove', { command: 'foo', args: [] });
    removeMcpServer('to-remove');
    const settings = readClaudeSettings();
    expect(settings.mcpServers?.['to-remove']).toBeUndefined();
  });

  it('does nothing if server does not exist', () => {
    setupTmpSettings();
    expect(() => removeMcpServer('nonexistent')).not.toThrow();
  });
});

describe('normalizeContextMcpServer', () => {
  it('moves legacy context_mcp to context-mcp', () => {
    setupTmpSettings();
    writeClaudeSettings({
      mcpServers: {
        context_mcp: { command: 'bun', args: ['legacy.js'], enabled: true },
      },
    });

    expect(normalizeContextMcpServer()).toBe(true);
    expect(readClaudeSettings().mcpServers).toEqual({
      'context-mcp': { command: 'bun', args: ['legacy.js'], enabled: true },
    });
  });

  it('keeps the canonical context-mcp entry when both names exist', () => {
    setupTmpSettings();
    writeClaudeSettings({
      mcpServers: {
        'context-mcp': { command: 'bun', args: ['canonical.js'], enabled: true },
        context_mcp: { command: 'bun', args: ['legacy.js'], enabled: true },
      },
    });

    expect(normalizeContextMcpServer()).toBe(true);
    expect(readClaudeSettings().mcpServers).toEqual({
      'context-mcp': { command: 'bun', args: ['canonical.js'], enabled: true },
    });
  });

  it('returns false when no context MCP entry exists', () => {
    setupTmpSettings();
    writeClaudeSettings({ mcpServers: { other: { command: 'bun', args: [] } } });

    expect(normalizeContextMcpServer()).toBe(false);
  });
});

describe('registerHook', () => {
  it('adds a new hook rule', () => {
    setupTmpSettings();
    const rule: HookRule = { hooks: [{ type: 'command', command: 'echo hello' }] };
    registerHook('PostToolUse', rule);
    const settings = readClaudeSettings();
    expect(settings.hooks?.['PostToolUse']).toHaveLength(1);
    expect(settings.hooks?.['PostToolUse'][0].hooks[0].command).toBe('echo hello');
  });

  it('deduplicates: same command replaces existing rule', () => {
    setupTmpSettings();
    const rule1: HookRule = { hooks: [{ type: 'command', command: 'echo hello' }] };
    const rule2: HookRule = {
      matcher: 'Bash',
      hooks: [{ type: 'command', command: 'echo hello' }],
    };
    registerHook('PostToolUse', rule1);
    registerHook('PostToolUse', rule2);
    const settings = readClaudeSettings();
    // Should still be 1 rule (replaced, not duplicated)
    expect(settings.hooks?.['PostToolUse']).toHaveLength(1);
    expect(settings.hooks?.['PostToolUse'][0].matcher).toBe('Bash');
  });

  it('appends a rule with a different command', () => {
    setupTmpSettings();
    const rule1: HookRule = { hooks: [{ type: 'command', command: 'echo hello' }] };
    const rule2: HookRule = { hooks: [{ type: 'command', command: 'echo world' }] };
    registerHook('PostToolUse', rule1);
    registerHook('PostToolUse', rule2);
    const settings = readClaudeSettings();
    expect(settings.hooks?.['PostToolUse']).toHaveLength(2);
  });

  it('deduplicates by script basename even when full paths differ', () => {
    setupTmpSettings();
    const rule1: HookRule = {
      hooks: [{ type: 'command', command: '/usr/bin/bun /opt/pkg/dist/omc/session-start-hook.js' }],
    };
    const rule2: HookRule = {
      hooks: [
        { type: 'command', command: '/usr/bin/bun /home/dev/repo/src/omc/session-start-hook.js' },
      ],
    };
    registerHook('SessionStart', rule1);
    registerHook('SessionStart', rule2);
    const settings = readClaudeSettings();
    // Same basename "session-start-hook.js" → replaced, not duplicated
    expect(settings.hooks?.['SessionStart']).toHaveLength(1);
    expect(settings.hooks?.['SessionStart'][0].hooks[0].command).toContain('/home/dev/repo/');
  });
});

describe('removeHook', () => {
  it('removes a hook by its script basename without affecting other hooks', () => {
    setupTmpSettings();
    const ruleContext: HookRule = {
      hooks: [{ type: 'command', command: '/usr/bin/bun /path/to/session-start-hook.js' }],
    };
    const ruleOther: HookRule = {
      hooks: [{ type: 'command', command: 'echo some other hook' }],
    };

    registerHook('SessionStart', ruleContext);
    registerHook('SessionStart', ruleOther);

    let settings = readClaudeSettings();
    expect(settings.hooks?.['SessionStart']).toHaveLength(2);

    removeHook('SessionStart', 'session-start-hook.js');

    settings = readClaudeSettings();
    expect(settings.hooks?.['SessionStart']).toHaveLength(1);
    expect(settings.hooks?.['SessionStart'][0].hooks[0].command).toBe('echo some other hook');
  });

  it('removes the event key entirely if no rules remain', () => {
    setupTmpSettings();
    const ruleContext: HookRule = {
      hooks: [{ type: 'command', command: '/usr/bin/bun /path/to/session-start-hook.js' }],
    };

    registerHook('SessionStart', ruleContext);

    removeHook('SessionStart', 'session-start-hook.js');

    const settings = readClaudeSettings();
    expect(settings.hooks?.['SessionStart']).toBeUndefined();
  });

  it('does nothing if hook or event does not exist', () => {
    setupTmpSettings();
    expect(() => removeHook('NonExistentEvent', 'some-hook.js')).not.toThrow();
  });
});
