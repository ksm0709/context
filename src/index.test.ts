import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import plugin from './index.js';

function expectNoDelegationWording(text: string): void {
  const lowerText = text.toLowerCase();

  expect(lowerText).not.toContain('subagent');
  expect(lowerText).not.toContain('task(');
  expect(text).not.toContain('서브에이전트');
  expect(text).not.toContain('위임');
}

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

function createUserMessage() {
  return {
    info: {
      id: 'msg-1',
      sessionID: 'sess-1',
      role: 'user' as const,
      time: { created: Date.now() },
      agent: 'test-agent',
      model: { providerID: 'anthropic', modelID: 'claude-3' },
    },
    parts: [] as Array<{ text?: string; type?: string; synthetic?: boolean }>,
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

  it('returns only the messages.transform hook', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as never);

    expect(hooks).toBeDefined();
    expect(Object.keys(hooks)).toEqual(['experimental.chat.messages.transform']);
  });

  it('scaffolds .opencode/context on first run', async () => {
    await plugin(createMockInput(tmpDir) as never);

    expect(existsSync(join(tmpDir, '.opencode', 'context'))).toBe(true);
  });

  it('appends turn-start and colocated knowledge index to the last user message', async () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Guide\n\nThis is the guide.');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(2);

    const appendedPart = output.messages[0].parts.at(-1);
    expect(appendedPart?.text).toContain('## Knowledge Context');
    expect(appendedPart?.text).toContain('## Available Knowledge');
    expect(appendedPart?.text).toContain('AGENTS.md');
    expect(appendedPart?.text?.indexOf('## Knowledge Context')).toBeLessThan(
      appendedPart?.text?.indexOf('## Available Knowledge') ?? 0
    );
    expect(appendedPart?.synthetic).toBeUndefined();
    expectNoDelegationWording(appendedPart?.text ?? '');
  });

  it('injects only the knowledge index when prompt files are missing', async () => {
    mkdirSync(join(tmpDir, '.opencode', 'context', 'prompts'), { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Guide\n\nThis is the guide.');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(1);
    expect(output.messages[0].parts).toHaveLength(1);
    expect(output.messages[0].parts[0]?.text).toContain('## Available Knowledge');
    expect(output.messages[0].parts[0]?.text).toContain('AGENTS.md');
    expect(output.messages[0].parts[0]?.text).not.toContain('## Knowledge Context');
  });

  it('skips injection when there are no messages', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [] as Array<ReturnType<typeof createUserMessage>> };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toEqual([]);
  });

  it('skips injection when there is no user message', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = {
      messages: [
        {
          ...createUserMessage(),
          info: { ...createUserMessage().info, role: 'assistant' as const },
        },
      ],
    };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(1);
    expect(output.messages[0].parts).toEqual([]);
  });

  it('skips turn-start append when prompt and knowledge content are empty', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), '');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(1);
    expect(output.messages[0].parts).toEqual([]);
  });

  it('injects only knowledge when turn-start prompt content is empty', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), '');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Guide\n\nThis is the guide.');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(1);
    expect(output.messages[0].parts).toHaveLength(1);
    expect(output.messages[0].parts[0]?.text).toContain('## Available Knowledge');
    expect(output.messages[0].parts[0]?.text).not.toContain('## Knowledge Context');
  });

  it('hot-reloads turn-start content between message transforms', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'OLD CONTENT');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const firstOutput = { messages: [createUserMessage()] };
    await hooks['experimental.chat.messages.transform']?.({} as never, firstOutput as never);
    expect(firstOutput.messages[0].parts[0]?.text).toContain('OLD CONTENT');

    writeFileSync(join(promptsDir, 'turn-start.md'), 'NEW CONTENT');

    const secondOutput = { messages: [createUserMessage()] };
    await hooks['experimental.chat.messages.transform']?.({} as never, secondOutput as never);
    expect(secondOutput.messages[0].parts[0]?.text).toContain('NEW CONTENT');
    expect(secondOutput.messages[0].parts[0]?.text).not.toContain('OLD CONTENT');
  });

  it('injects turn-end as a separate user message only when content is non-empty', async () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Project Guide\n\nThis is the guide.');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(2);
    const turnEndMessage = output.messages[1];
    const turnEndPart = turnEndMessage.parts[0];

    expect(turnEndMessage.info.role).toBe('user');
    expect(turnEndPart?.text).toContain('<system-reminder>');
    expect(turnEndPart?.text).toContain('## 작업 마무리');
    expect(turnEndPart?.synthetic).toBeUndefined();
    expectNoDelegationWording(turnEndPart?.text ?? '');
  });

  it('skips turn-end injection when turn-end prompt content is empty', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), 'TURN START CONTENT');
    writeFileSync(join(promptsDir, 'turn-end.md'), '');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(1);
    expect(output.messages[0].parts[0]?.text).toContain('TURN START CONTENT');
    expectNoDelegationWording(output.messages[0].parts[0]?.text ?? '');
  });

  it('hot-reloads turn-end content between message transforms', async () => {
    const promptsDir = join(tmpDir, '.opencode', 'context', 'prompts');
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(tmpDir, '.opencode', 'context', 'config.jsonc'), '{}');
    writeFileSync(join(promptsDir, 'turn-start.md'), '');
    writeFileSync(join(promptsDir, 'turn-end.md'), 'OLD CONTENT');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const firstOutput = { messages: [createUserMessage()] };
    await hooks['experimental.chat.messages.transform']?.({} as never, firstOutput as never);
    expect(firstOutput.messages[1].parts[0]?.text).toContain('OLD CONTENT');

    writeFileSync(join(promptsDir, 'turn-end.md'), 'NEW CONTENT');

    const secondOutput = { messages: [createUserMessage()] };
    await hooks['experimental.chat.messages.transform']?.({} as never, secondOutput as never);
    expect(secondOutput.messages[1].parts[0]?.text).toContain('NEW CONTENT');
    expect(secondOutput.messages[1].parts[0]?.text).not.toContain('OLD CONTENT');
  });
});
