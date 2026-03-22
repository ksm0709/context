import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import plugin from './index.js';

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
  let originalOmxEnv: string | undefined;

  beforeEach(() => {
    originalOmxEnv = process.env.OMX_HOOK_PLUGINS;
    delete process.env.OMX_HOOK_PLUGINS;
    tmpDir = join(tmpdir(), `plugin-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (originalOmxEnv !== undefined) {
      process.env.OMX_HOOK_PLUGINS = originalOmxEnv;
    } else {
      delete process.env.OMX_HOOK_PLUGINS;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the config and messages.transform hooks', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as never);

    expect(hooks).toBeDefined();
    expect(Object.keys(hooks)).toEqual(['config', 'experimental.chat.messages.transform']);
  });

  it('scaffolds .context/ on first run', async () => {
    await plugin(createMockInput(tmpDir) as never);

    expect(existsSync(join(tmpDir, '.context'))).toBe(true);
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

  it('injects turn-end reminder as a separate user message', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as never);
    const output = { messages: [createUserMessage()] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(2);
    const turnEndMessage = output.messages[1];
    const turnEndPart = turnEndMessage.parts[0];

    expect(turnEndMessage.info.role).toBe('user');
    expect(turnEndPart?.text).toContain('<system-reminder> TURN END.');
    expect(turnEndPart?.text).toContain("call the 'submit_turn_complete' MCP tool");
    expect(turnEndPart?.synthetic).toBeUndefined();
  });

  it('skips injection if last user message already has turn-end reminder', async () => {
    const hooks = await plugin(createMockInput(tmpDir) as never);
    const userMsg = createUserMessage();
    userMsg.parts.push({
      type: 'text',
      text: "<system-reminder> TURN END. You MUST call the 'submit_turn_complete' MCP tool to finalize your work and record notes. Do not wait for user input. </system-reminder>",
    });
    const output = { messages: [userMsg] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    expect(output.messages).toHaveLength(1);
  });

  it('suppresses turn-end injection if a valid .work-complete file exists and is newer than the user message', async () => {
    const signalPath = join(tmpDir, '.context', '.work-complete');
    mkdirSync(join(tmpDir, '.context'), { recursive: true });
    writeFileSync(signalPath, 'session_id=sess-1\nturn_id=123');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const userMsg = createUserMessage();
    // Make user message older than the signal file
    userMsg.info.time.created = statSync(signalPath).mtimeMs - 1000;
    const output = { messages: [userMsg] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    // Should be suppressed
    expect(output.messages).toHaveLength(1);
    expect(existsSync(signalPath)).toBe(true);
  });

  it('deletes stale .work-complete files and re-enables injection', async () => {
    const signalPath = join(tmpDir, '.context', '.work-complete');
    mkdirSync(join(tmpDir, '.context'), { recursive: true });
    writeFileSync(signalPath, 'session_id=sess-1\nturn_id=123');

    const hooks = await plugin(createMockInput(tmpDir) as never);
    const userMsg = createUserMessage();
    // Make user message newer than the signal file
    userMsg.info.time.created = statSync(signalPath).mtimeMs + 1000;
    const output = { messages: [userMsg] };

    await hooks['experimental.chat.messages.transform']?.({} as never, output as never);

    // Should NOT be suppressed
    expect(output.messages).toHaveLength(2);
    expect(output.messages[1].parts[0]?.text).toContain('TURN END');
    // File should be deleted
    expect(existsSync(signalPath)).toBe(false);
  });
});
