import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMcpServer } from './mcp-server.js';
import * as fs from 'fs/promises';

const mockRegisterTool = vi.fn();
type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: Array<{ text: string; type: string }>;
  isError?: boolean;
}>;
type RegisteredToolCall = [string, { inputSchema: Record<string, unknown> }, ToolHandler];

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class MockMcpServer {
    server = {
      _requestHandlers: new Map(),
      setRequestHandler: vi.fn(),
      _capabilities: { tools: { listChanged: true } },
    };
    registerTool = mockRegisterTool;
    connect = vi.fn();
  }
  return { McpServer: MockMcpServer };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: {
    shape: { method: { value: 'tools/list' } },
  },
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('./config.js', () => ({
  loadConfig: vi.fn(),
}));

import { execSync } from 'child_process';
import { loadConfig } from './config.js';

function getRegisteredToolCall(name: string): RegisteredToolCall {
  const call = mockRegisterTool.mock.calls.find(
    (candidate): candidate is RegisteredToolCall => candidate[0] === name
  );
  expect(call).toBeDefined();
  return call as RegisteredToolCall;
}

describe('mcp-server (Workflow Enforcer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
    startMcpServer();
  });

  it('registers exactly 4 tools', () => {
    const toolNames = mockRegisterTool.mock.calls.map((c) => c[0]);
    expect(toolNames).toHaveLength(4);
    expect(toolNames).toContain('run_smoke_check');
    expect(toolNames).toContain('check_hash');
    expect(toolNames).toContain('check_scope');
    expect(toolNames).toContain('submit_turn_complete');
  });

  it('does not register any memory tools', () => {
    const toolNames = mockRegisterTool.mock.calls.map((c) => c[0]);
    expect(toolNames).not.toContain('search_knowledge');
    expect(toolNames).not.toContain('read_knowledge');
    expect(toolNames).not.toContain('append_daily_note');
    expect(toolNames).not.toContain('read_daily_note');
    expect(toolNames).not.toContain('create_knowledge_note');
    expect(toolNames).not.toContain('update_knowledge_note');
  });

  describe('run_smoke_check tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      const call = getRegisteredToolCall('run_smoke_check');
      handler = call[2];
    });

    it('returns error when no matching smokeCheck entry found', async () => {
      vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
      const result = await handler({ name: 'tests' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('no smokeCheck named "tests"');
    });

    it('writes signal file when command succeeds', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      const result = await handler({ name: 'tests' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('passed');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-tests-passed'),
        expect.stringContaining('timestamp='),
        'utf-8'
      );
    });

    it('does not write signal file when command fails', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed: npm test');
      });

      const result = await handler({ name: 'tests' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('failed');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects signal paths outside .context/', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'bad', signal: '/tmp/escape' }],
        smokeChecks: [{ name: 'bad', command: 'echo hi', signal: '/tmp/escape' }],
      });

      const result = await handler({ name: 'bad' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('.context/');
    });
  });

  describe('check_hash tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      handler = getRegisteredToolCall('check_hash')[2];
    });

    it('passes and writes signal file when working tree is clean', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(Buffer.from('')) // git status --porcelain
        .mockReturnValueOnce(Buffer.from('abc1234 feat: something')); // git log

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('passed');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-hash-passed'),
        expect.stringContaining('git_log='),
        'utf-8'
      );
    });

    it('fails when there are uncommitted changes', async () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(' M src/index.ts'));

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('uncommitted changes');
    });

    it('auto-passes (skip) when not in a git repo', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('not a git repository');
      });

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('skipped');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-hash-passed'),
        expect.stringContaining('skipped=true'),
        'utf-8'
      );
    });
  });

  describe('check_scope tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      handler = getRegisteredToolCall('check_scope')[2];
    });

    it('writes scope signal file with provided notes', async () => {
      const result = await handler({ notes: 'Scope stayed within intended boundaries.' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('recorded');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-scope-passed'),
        expect.stringContaining('notes=Scope stayed'),
        'utf-8'
      );
    });

    it('fails when notes are too short', async () => {
      const result = await handler({ notes: 'short' });
      expect(result.isError).toBe(true);
    });
  });

  describe('submit_turn_complete tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      handler = getRegisteredToolCall('submit_turn_complete')[2];
    });

    it('schema has no manual input fields', () => {
      const schema = getRegisteredToolCall('submit_turn_complete')[1].inputSchema;
      expect(schema).not.toHaveProperty('quality_check_output');
      expect(schema).not.toHaveProperty('checkpoint_commit_hashes');
      expect(schema).not.toHaveProperty('scope_review_notes');
    });

    it('succeeds when all built-in + config signal files are fresh', async () => {
      vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
      const freshTimestamp = Date.now() - 5 * 60 * 1000;
      vi.mocked(fs.readFile).mockResolvedValue(`session_id=\ntimestamp=${freshTimestamp}\n` as never);

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('complete');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.work-complete'),
        expect.stringContaining('timestamp='),
        'utf-8'
      );
    });

    it('fails when built-in check_hash signal is missing', async () => {
      vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'ENOENT' })
      );

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('check_hash');
    });

    it('fails when built-in signal is stale', async () => {
      vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
      const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000;
      vi.mocked(fs.readFile).mockResolvedValue(`session_id=\ntimestamp=${staleTimestamp}\n` as never);

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('stale');
    });

    it('fails when config check signal is missing', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [],
      });
      const freshTimestamp = Date.now() - 5 * 60 * 1000;
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(`session_id=\ntimestamp=${freshTimestamp}\n` as never) // hash
        .mockResolvedValueOnce(`session_id=\ntimestamp=${freshTimestamp}\n` as never) // scope
        .mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOENT' })); // tests

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tests');
    });
  });
});
