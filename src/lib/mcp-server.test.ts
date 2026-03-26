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
    };

    registerTool = mockRegisterTool;
    connect = vi.fn();
  }

  return {
    McpServer: MockMcpServer,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn(),
  };
});

vi.mock('@modelcontextprotocol/sdk/types.js', () => {
  return {
    ListToolsRequestSchema: {
      shape: {
        method: {
          value: 'tools/list',
        },
      },
    },
  };
});

vi.mock('fs/promises', () => ({
  appendFile: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('mcp-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMcpServer();
  });

  describe('search_knowledge tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      const call = mockRegisterTool.mock.calls.find(
        (candidate): candidate is RegisteredToolCall => candidate[0] === 'search_knowledge'
      );
      expect(call).toBeDefined();
      handler = call[2];
    });

    it('returns ranked metadata-first note summaries for partial natural language queries', async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dirPath: unknown) => {
        const dir = String(dirPath);
        if (dir.endsWith('/docs')) {
          return ['metadata-search-guide.md', 'body-only-note.md'] as never;
        }

        return [] as never;
      });

      vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
        const file = String(filePath);

        if (file.endsWith('metadata-search-guide.md')) {
          return `---
title: Metadata Search Guide
description: Weighted note discovery for related knowledge.
tags:
  - search
  - knowledge
---

# Metadata Search Guide

Use metadata-first search to compare notes before opening them.
` as never;
        }

        if (file.endsWith('body-only-note.md')) {
          return `# Body Only Note

This note mentions knowledge search once in the body, but it has no metadata support.
` as never;
        }

        throw new Error(`Unexpected file read: ${file}`);
      });

      const result = await handler({
        query: 'How can the agent find related knowledge notes with metadata search?',
        limit: 10,
      });

      const output = result.content[0].text;

      expect(result.isError).toBeUndefined();
      expect(output).toContain('Result 1');
      expect(output).toContain('Title: Metadata Search Guide');
      expect(output).toContain('Description: Weighted note discovery for related knowledge.');
      expect(output).toContain('Tags: search, knowledge');
      expect(output).toContain('Score:');
      expect(output).toContain('Match reasons:');
      expect(output).toContain('Open a relevant note with read_knowledge');
      expect(output.indexOf('Path: docs/metadata-search-guide.md')).toBeLessThan(
        output.indexOf('Path: docs/body-only-note.md')
      );
    });
  });

  describe('read_knowledge tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      const call = mockRegisterTool.mock.calls.find(
        (candidate): candidate is RegisteredToolCall => candidate[0] === 'read_knowledge'
      );
      expect(call).toBeDefined();
      handler = call[2];
    });

    it('appends linked-note metadata and exploration guidance', async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dirPath: unknown) => {
        const dir = String(dirPath);
        if (dir.endsWith('/docs')) {
          return ['entry.md', 'related-note.md'] as never;
        }

        return [] as never;
      });

      vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
        const file = String(filePath);

        if (file.endsWith('entry.md')) {
          return `---
title: Entry Note
---

# Entry Note

Open [[Related Note]] when you need more context.
` as never;
        }

        if (file.endsWith('related-note.md')) {
          return `---
title: Related Note
description: Deeper context for the search workflow.
tags:
  - linked
  - context
---

# Related Note

Additional context lives here.
` as never;
        }

        throw new Error(`Unexpected file read: ${file}`);
      });

      const result = await handler({ path: 'docs/entry.md' });
      const output = result.content[0].text;

      expect(result.isError).toBeUndefined();
      expect(output).toContain('# Entry Note');
      expect(output).toContain('## Related Notes');
      expect(output).toContain('Title: Related Note');
      expect(output).toContain('Path: docs/related-note.md');
      expect(output).toContain('Description: Deeper context for the search workflow.');
      expect(output).toContain('Tags: linked, context');
      expect(output).toContain('If one of these related notes looks relevant');
    });
  });

  describe('submit_turn_complete tool', () => {
    let toolDef: { inputSchema: Record<string, unknown> };
    let handler: ToolHandler;

    beforeEach(() => {
      const call = mockRegisterTool.mock.calls.find(
        (candidate): candidate is RegisteredToolCall => candidate[0] === 'submit_turn_complete'
      );
      expect(call).toBeDefined();
      toolDef = call[1];
      handler = call[2];
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
