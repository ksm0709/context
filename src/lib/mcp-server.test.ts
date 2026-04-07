import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMcpServer } from './mcp-server.js';
import * as fs from 'node:fs/promises';

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

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('./config.js', () => ({
  loadConfig: vi.fn(),
}));

import { execSync } from 'node:child_process';
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

  it('registers exactly 3 tools', () => {
    const toolNames = mockRegisterTool.mock.calls.map((c) => c[0]);
    expect(toolNames).toHaveLength(3);
    expect(toolNames).toContain('run_smoke_check');
    expect(toolNames).toContain('submit_turn_complete');
    expect(toolNames).toContain('infer_smoke_checks');
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

    it('writes caller=agent in signal file by default', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      await handler({ name: 'tests' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-tests-passed'),
        expect.stringContaining('caller=agent'),
        'utf-8'
      );
    });

    it('writes caller=reviewer in signal file when caller is reviewer', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      await handler({ name: 'tests', caller: 'reviewer' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-tests-passed'),
        expect.stringContaining('caller=reviewer'),
        'utf-8'
      );
    });

    it('uses entry.timeout when configured', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          {
            name: 'tests',
            command: 'npm test',
            signal: '.context/.check-tests-passed',
            timeout: 60_000,
          },
        ],
      });
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      await handler({ name: 'tests' });

      expect(execSync).toHaveBeenCalledWith(
        'npm test',
        expect.objectContaining({ timeout: 60_000 })
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

    it('runs command when triggerCommand exits 0', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'lint', signal: '.context/.check-lint-passed' }],
        smokeChecks: [
          {
            name: 'lint',
            command: 'npm run lint',
            signal: '.context/.check-lint-passed',
            triggerCommand: 'test -f src/index.ts',
          },
        ],
      });
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      const result = await handler({ name: 'lint' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('passed');
      expect(execSync).toHaveBeenCalledTimes(2);
    });

    it('writes skip signal when triggerCommand exits non-zero', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'lint', signal: '.context/.check-lint-passed' }],
        smokeChecks: [
          {
            name: 'lint',
            command: 'npm run lint',
            signal: '.context/.check-lint-passed',
            triggerCommand: 'git diff --name-only | grep -q .cpp',
          },
        ],
      });
      vi.mocked(execSync).mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.includes('grep')) throw new Error('exit 1');
        return Buffer.from('');
      });
      const result = await handler({ name: 'lint' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('skipped');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-lint-passed'),
        expect.stringContaining('skipped=true'),
        'utf-8'
      );
      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('returns error when triggerCommand times out', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'lint', signal: '.context/.check-lint-passed' }],
        smokeChecks: [
          {
            name: 'lint',
            command: 'npm run lint',
            signal: '.context/.check-lint-passed',
            triggerCommand: 'sleep 999',
          },
        ],
      });
      vi.mocked(execSync).mockImplementation(() => {
        const err = new Error('Command timed out');
        (err as Error & { killed: boolean }).killed = true;
        throw err;
      });
      const result = await handler({ name: 'lint' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timed out');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('returns skip message when enabled is false', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed', enabled: false },
        ],
      });

      const result = await handler({ name: 'tests' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('disabled');
      expect(result.content[0].text).toContain('enabled: false');
      expect(execSync).not.toHaveBeenCalled();
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

  describe('infer_smoke_checks tool', () => {
    it('is registered', () => {
      const toolNames = mockRegisterTool.mock.calls.map((c) => c[0]);
      expect(toolNames).toContain('infer_smoke_checks');
    });

    it('returns already-configured message when checks exist', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [],
      });
      const handler = getRegisteredToolCall('infer_smoke_checks')[2];
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('already configured');
    });
  });

  describe('parseSignalFile backward compat', () => {
    it('run_smoke_check signal without caller field defaults to agent in written content', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));
      const handler = getRegisteredToolCall('run_smoke_check')[2];

      // No caller provided — should default to 'agent'
      await handler({ name: 'tests' });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.check-tests-passed'),
        expect.stringContaining('caller=agent'),
        'utf-8'
      );
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

    it('returns warning (not error) when no checks configured', async () => {
      vi.mocked(loadConfig).mockReturnValue({ checks: [], smokeChecks: [] });
      const freshTimestamp = Date.now() - 5 * 60 * 1000;
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${freshTimestamp}\n` as never
      );

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Warning');
      expect(result.content[0].text).toContain('infer_smoke_checks');
    });

    it('succeeds when all smokeCheck signal files are fresh', async () => {
      const freshTimestamp = Date.now() - 5 * 60 * 1000;
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${freshTimestamp}\n` as never
      );

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('complete');
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.work-complete'),
        expect.stringContaining('timestamp='),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.work-complete'),
        expect.stringContaining('pid='),
        'utf-8'
      );
    });

    it('accepts skip signal (skipped=true) as valid', async () => {
      const freshTimestamp = Date.now() - 5 * 60 * 1000;
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${freshTimestamp}\nskipped=true\n` as never
      );

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('complete');
    });

    it('fails when smokeCheck signal is missing', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'ENOENT' })
      );

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tests');
    });

    it('skips disabled checks and succeeds when remaining active checks pass', async () => {
      const freshTimestamp = Date.now() - 5 * 60 * 1000;
      vi.mocked(loadConfig).mockReturnValue({
        checks: [],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
          { name: 'lint', command: 'npm run lint', signal: '.context/.check-lint-passed', enabled: false },
        ],
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${freshTimestamp}\n` as never
      );

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('complete');
      // readFile called only once (for the active check, not the disabled one)
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it('warns when all configured checks are disabled', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed', enabled: false },
          { name: 'lint', command: 'npm run lint', signal: '.context/.check-lint-passed', enabled: false },
        ],
      });

      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Warning');
      expect(result.content[0].text).toContain('disabled');
    });

    it('fails when smokeCheck signal is stale', async () => {
      vi.mocked(loadConfig).mockReturnValue({
        checks: [{ name: 'tests', signal: '.context/.check-tests-passed' }],
        smokeChecks: [
          { name: 'tests', command: 'npm test', signal: '.context/.check-tests-passed' },
        ],
      });
      const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000;
      vi.mocked(fs.readFile).mockResolvedValue(
        `session_id=\ntimestamp=${staleTimestamp}\n` as never
      );

      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('stale');
    });
  });
});
