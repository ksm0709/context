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

  it('appends turn-start to last user message parts via messages.transform', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'TURN START CONTENT');
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
          parts: [] as any[],
        },
      ],
    };
    await hooks['experimental.chat.messages.transform']!({} as any, output as any);

    const appendedPart = output.messages[0].parts.at(-1) as any;
    expect(appendedPart).toBeDefined();
    expect(appendedPart.text).toContain('TURN START CONTENT');
  });

  it('system.transform does not inject turn-start or turn-end', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'TURN START CONTENT');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'TURN END CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const output = { system: [] as string[] };
    await hooks['experimental.chat.system.transform']!({} as any, output);

    expect(output.system.some((s) => s.includes('TURN START CONTENT'))).toBe(false);
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

  it('hot-reloads turn-start content via messages.transform', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'OLD CONTENT');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');

    const hooks = await plugin(createMockInput(tmpDir) as any);
    const makeOutput = () => ({
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
          parts: [] as any[],
        },
      ],
    });

    const output1 = makeOutput();
    await hooks['experimental.chat.messages.transform']!({} as any, output1 as any);
    expect(output1.messages[0].parts.at(-1) as any).toBeDefined();
    expect((output1.messages[0].parts.at(-1) as any).text).toContain('OLD CONTENT');

    writeFileSync(join(promptsDir, 'turn-start.md'), 'NEW CONTENT');

    const output2 = makeOutput();
    await hooks['experimental.chat.messages.transform']!({} as any, output2 as any);
    expect((output2.messages[0].parts.at(-1) as any).text).toContain('NEW CONTENT');
    expect((output2.messages[0].parts.at(-1) as any).text).not.toContain('OLD CONTENT');
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

  it('injects turn-end as real user message via messages.transform', async () => {
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

  it('turn-start part does not have synthetic flag', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'TURN START');
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
          parts: [] as any[],
        },
      ],
    };
    await hooks['experimental.chat.messages.transform']!({} as any, output as any);

    const appendedPart = output.messages[0].parts.at(-1) as any;
    expect(appendedPart.text).toContain('TURN START');
    expect(appendedPart.synthetic).toBeUndefined();
  });

  it('turn-end message does not have synthetic flag', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), '');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'TURN END');

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
          parts: [] as any[],
        },
      ],
    };
    await hooks['experimental.chat.messages.transform']!({} as any, output as any);

    const injectedMsg = output.messages.at(-1)!;
    const textPart = injectedMsg.parts.find((p: any) => p.type === 'text') as any;
    expect(textPart.synthetic).toBeUndefined();
  });
});
