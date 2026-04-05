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

  it('registers exactly 2 tools: run_smoke_check and submit_turn_complete', () => {
    const toolNames = mockRegisterTool.mock.calls.map((c) => c[0]);
    expect(toolNames).toHaveLength(2);
    expect(toolNames).toContain('run_smoke_check');
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

  describe('submit_turn_complete tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      const call = getRegisteredToolCall('submit_turn_complete');
      handler = call[2];
    });

    it('schema has no daily_note_update_proof or knowledge_note_proof', () => {
      const call = getRegisteredToolCall('submit_turn_complete');
      const schema = call[1].inputSchema;
      expect(schema).not.toHaveProperty('daily_note_update_proof');
      expect(schema).not.toHaveProperty('knowledge_note_proof');
      expect(schema).toHaveProperty('quality_check_output');
      expect(schema).toHaveProperty('checkpoint_commit_hashes');
      expect(schema).toHaveProperty('scope_review_notes');
    });

    it('succeeds with empty checks config', async () => {
      vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
      const result = await handler({
        quality_check_output: 'All 42 tests passed. Lint: 0 errors.',
        checkpoint_commit_hashes: 'abc1234',
        scope_review_notes: 'Scope stayed within intended boundaries.',
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('complete');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.work-complete'),
        expect.stringContaining('timestamp='),
        'utf-8'
      );
    });

    it('fails when signal file is missing', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [],
      });
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'ENOENT' })
      );

      const result = await handler({
        quality_check_output: 'All 42 tests passed. Lint: 0 errors.',
        checkpoint_commit_hashes: 'abc1234',
        scope_review_notes: 'Scope stayed within intended boundaries.',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('fails when signal file is stale (older than 1 hour)', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [],
      });
      const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${staleTimestamp}\n` as never
      );

      const result = await handler({
        quality_check_output: 'All 42 tests passed. Lint: 0 errors.',
        checkpoint_commit_hashes: 'abc1234',
        scope_review_notes: 'Scope stayed within intended boundaries.',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('stale');
    });

    it('succeeds when all signal files are fresh', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [],
      });
      const freshTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${freshTimestamp}\n` as never
      );

      const result = await handler({
        quality_check_output: 'All 42 tests passed. Lint: 0 errors.',
        checkpoint_commit_hashes: 'abc1234',
        scope_review_notes: 'Scope stayed within intended boundaries.',
      });

      expect(result.isError).toBeUndefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.work-complete'),
        expect.stringContaining('timestamp='),
        'utf-8'
      );
    });

    it('fails when required fields are missing or too short', async () => {
      const result = await handler({
        quality_check_output: 'short',
        checkpoint_commit_hashes: 'abc',
        scope_review_notes: 'short',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('quality_check_output');
      expect(result.content[0].text).toContain('checkpoint_commit_hashes');
      expect(result.content[0].text).toContain('scope_review_notes');
    });
  });
});
