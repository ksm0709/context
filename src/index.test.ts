import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Plugin을 default import
import plugin from './index.js';

// Mock PluginInput
function createMockInput(projectDir: string) {
  return {
    directory: projectDir,
    client: {
      app: {
        log: () => Promise.resolve(),
      },
    },
  };
}

describe('context plugin', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `plugin-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns hooks object with experimental.chat.system.transform and messages.transform', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as any);
    expect(hooks).toBeDefined();
    expect(hooks['experimental.chat.system.transform']).toBeDefined();
    expect(hooks['experimental.chat.messages.transform']).toBeDefined();
  });

  it('scaffolds .opencode/context/ on first run', async () => {
    await plugin(createMockInput(tmpDir) as any);
    expect(existsSync(join(tmpDir, '.opencode', 'context'))).toBe(true);
  });

  it('injects turn-start content into output.system', async () => {
    // Setup: create prompt files
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'TURN START CONTENT');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'TURN END CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = { system: [] as string[] };
    await hooks['experimental.chat.system.transform']!({} as any, output);

    expect(output.system.some((s) => s.includes('TURN START CONTENT'))).toBe(true);
  });

  it('does NOT inject turn-end content into output.system', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'START');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'TURN END CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = { system: [] as string[] };
    await hooks['experimental.chat.system.transform']!({} as any, output);

    expect(output.system.some((s) => s.includes('TURN END CONTENT'))).toBe(false);
  });

  it('does not crash when prompt files are missing', async () => {
    // No prompt files, just empty dir
    mkdirSync(join(tmpDir, '.opencode', 'context', 'prompts'), { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = { system: [] as string[] };
    // Should not throw - just call and verify no error
    let error: unknown = null;
    try {
      await hooks['experimental.chat.system.transform']!({} as any, output);
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
  });

  it('hot-reloads prompt file content on each hook call', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'OLD CONTENT');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');

    const hooks = await plugin(createMockInput(tmpDir) as any);

    // First call
    const output1 = { system: [] as string[] };
    await hooks['experimental.chat.system.transform']!({} as any, output1);
    expect(output1.system.some((s) => s.includes('OLD CONTENT'))).toBe(true);

    // Modify file
    writeFileSync(join(promptsDir, 'turn-start.md'), 'NEW CONTENT');

    // Second call - should pick up new content
    const output2 = { system: [] as string[] };
    await hooks['experimental.chat.system.transform']!({} as any, output2);
    expect(output2.system.some((s) => s.includes('NEW CONTENT'))).toBe(true);
    expect(output2.system.some((s) => s.includes('OLD CONTENT'))).toBe(false);
  });

  it('injects knowledge index when AGENTS.md exists', async () => {
    mkdirSync(join(tmpDir, '.opencode', 'context', 'prompts'), { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Guide\n\nThis is the guide.');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = { system: [] as string[] };
    await hooks['experimental.chat.system.transform']!({} as any, output);

    expect(output.system.some((s) => s.includes('AGENTS.md'))).toBe(true);
  });

  it('injects turn-end as synthetic user message via messages.transform', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'START');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'TURN END CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = {
      messages: [
        {
          info: {
            id: 'msg-1',
            sessionID: 'sess-1',
            role: 'user' as const,
            time: { created: Date.now() },
            agent: 'test-agent',
            model: { providerID: 'anthropic', modelID: 'claude-3' },
          },
          parts: [],
        },
      ],
    };
    await hooks['experimental.chat.messages.transform']!({} as any, output as any);

    expect(output.messages).toHaveLength(2);
    const lastMsg = output.messages[output.messages.length - 1];
    expect(lastMsg.info.role).toBe('user');
    const textPart = lastMsg.parts.find((p: any) => p.type === 'text') as any;
    expect(textPart).toBeDefined();
    expect(textPart.text).toContain('<system-reminder>');
    expect(textPart.text).toContain('TURN END CONTENT');
    expect(textPart.synthetic).toBe(true);
  });

  it('skips turn-end injection when messages array is empty', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'TURN END CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = { messages: [] as any[] };
    let error: unknown = null;
    try {
      await hooks['experimental.chat.messages.transform']!({} as any, output as any);
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
    expect(output.messages).toHaveLength(0);
  });

  it('skips turn-end injection when turn-end.md is empty', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = {
      messages: [
        {
          info: {
            id: 'msg-1',
            sessionID: 'sess-1',
            role: 'user' as const,
            time: { created: Date.now() },
            agent: 'test-agent',
            model: { providerID: 'anthropic', modelID: 'claude-3' },
          },
          parts: [],
        },
      ],
    };
    await hooks['experimental.chat.messages.transform']!({} as any, output as any);
    expect(output.messages).toHaveLength(1);
  });

  it('hot-reloads turn-end content in messages.transform', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'OLD CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const makeMessages = () => [
      {
        info: {
          id: 'msg-1',
          sessionID: 'sess-1',
          role: 'user' as const,
          time: { created: Date.now() },
          agent: 'test-agent',
          model: { providerID: 'anthropic', modelID: 'claude-3' },
        },
        parts: [],
      },
    ];

    const output1 = { messages: makeMessages() };
    await hooks['experimental.chat.messages.transform']!({} as any, output1 as any);
    const text1 = (output1.messages[1].parts[0] as any).text;
    expect(text1).toContain('OLD CONTENT');

    writeFileSync(join(promptsDir, 'turn-end.md'), 'NEW CONTENT');

    const output2 = { messages: makeMessages() };
    await hooks['experimental.chat.messages.transform']!({} as any, output2 as any);
    const text2 = (output2.messages[1].parts[0] as any).text;
    expect(text2).toContain('NEW CONTENT');
    expect(text2).not.toContain('OLD CONTENT');
  });
});
