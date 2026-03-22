import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startMcpServer } from './mcp-server.js';
import * as fs from 'fs/promises';

const mockRegisterTool = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: vi.fn().mockImplementation(() => ({
      server: {
        _requestHandlers: new Map(),
        setRequestHandler: vi.fn(),
      },
      registerTool: mockRegisterTool,
      connect: vi.fn(),
    })),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn(),
  };
});

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('mcp-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMcpServer();
  });

  describe('submit_turn_complete tool', () => {
    let toolDef: any;
    let handler: any;

    beforeEach(() => {
      const call = mockRegisterTool.mock.calls.find((c: any) => c[0] === 'submit_turn_complete');
      expect(call).toBeDefined();
      toolDef = call![1];
      handler = call![2];
    });

    it('should have the correct schema', () => {
      const schema = toolDef.inputSchema;
      expect(schema).toHaveProperty('daily_note_update_proof');
      expect(schema).toHaveProperty('knowledge_note_proof');
      expect(schema).toHaveProperty('quality_check_output');
      expect(schema).toHaveProperty('checkpoint_commit_hashes');
      expect(schema).toHaveProperty('scope_review_notes');
    });

    it('should return success when all required proofs are provided', async () => {
      const result = await handler({
        daily_note_update_proof: 'path/to/daily/note.md',
        knowledge_note_proof: 'path/to/knowledge/note.md',
        quality_check_output: 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8',
        checkpoint_commit_hashes: 'abcdef1',
        scope_review_notes: 'Scope was reviewed and is fine.',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Turn successfully marked as complete.');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return success with warnings when optional proofs are skipped', async () => {
      const result = await handler({
        daily_note_update_proof: 'skipped',
        knowledge_note_proof: 'SKIPPED',
        quality_check_output: 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8',
        checkpoint_commit_hashes: 'abcdef1',
        scope_review_notes: 'Scope was reviewed and is fine.',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Turn successfully marked as complete.');
      expect(result.content[0].text).toContain('Warning: Daily note was skipped.');
      expect(result.content[0].text).toContain('Warning: Knowledge note was skipped.');
    });

    it('should return error when required proofs are missing or too short', async () => {
      const result = await handler({
        daily_note_update_proof: 'skipped',
        knowledge_note_proof: 'skipped',
        quality_check_output: 'short', // < 20 chars
        checkpoint_commit_hashes: 'abc', // < 7 chars
        scope_review_notes: 'short', // < 10 chars
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Error: The following required steps were not completed or provided insufficient proof'
      );
      expect(result.content[0].text).toContain('quality_check_output');
      expect(result.content[0].text).toContain('checkpoint_commit_hashes');
      expect(result.content[0].text).toContain('scope_review_notes');
    });

    it('should return error when optional proofs are provided but too short', async () => {
      const result = await handler({
        daily_note_update_proof: 'bad', // < 5 chars and not 'skipped'
        knowledge_note_proof: 'bad', // < 5 chars and not 'skipped'
        quality_check_output: 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8',
        checkpoint_commit_hashes: 'abcdef1',
        scope_review_notes: 'Scope was reviewed and is fine.',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('daily_note_update_proof (too short)');
      expect(result.content[0].text).toContain('knowledge_note_proof (too short)');
    });
  });
});
