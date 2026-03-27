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

function getRegisteredToolCall(name: string): RegisteredToolCall {
  const call = mockRegisterTool.mock.calls.find(
    (candidate): candidate is RegisteredToolCall => candidate[0] === name
  );
  expect(call).toBeDefined();
  return call as RegisteredToolCall;
}

describe('mcp-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMcpServer();
  });

  describe('search_knowledge tool', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      const call = getRegisteredToolCall('search_knowledge');
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
      const call = getRegisteredToolCall('read_knowledge');
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

  describe('create_knowledge_note tool', () => {
    let toolDef: { inputSchema: Record<string, unknown> };
    let handler: ToolHandler;

    beforeEach(() => {
      const call = getRegisteredToolCall('create_knowledge_note');
      toolDef = call[1];
      handler = call[2];
    });

    it('includes template-mode schema fields', () => {
      expect(toolDef.inputSchema).toHaveProperty('content');
      expect(toolDef.inputSchema).toHaveProperty('template');
      expect(toolDef.inputSchema).toHaveProperty('linked_notes');
      expect(toolDef.inputSchema).toHaveProperty('tags');
    });

    it('creates a templated note when content fully matches the template structure', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (filePath: unknown) => {
        const file = String(filePath);
        if (file.endsWith('.context/templates/bug.md')) {
          return `# Bug: [간단한 설명]

## 증상

- 에러 메시지: \`...\`
- 관찰된 동작: ...

## 원인

실제 원인 분석

## 해결

// 수정 코드

## 예방

향후 같은 문제를 방지하는 방법

## 관련 노트

- [[유사-버그.md]] / [[예방-패턴.md]]
` as never;
        }

        throw new Error(`Unexpected file read: ${file}`);
      });

      const completedMarkdown = `# Bug: stale mock-mcp entry in codex config

## 증상

- \`mock-mcp\`가 시작 실패한다.
- \`/mcp\`에서 도구가 비어 있다.

## 원인

삭제된 절대경로를 가리키는 stale entry가 남아 있었다.

## 해결

설치 및 session-start에서 stale entry를 제거하도록 수정했다.

## 예방

missing absolute path를 가리키는 경우만 좁게 정리한다.

## 관련 노트

- [[omx-setup]]
- [[architecture]]
`;

      const result = await handler({
        title: 'stale mock-mcp entry in codex config',
        template: 'bug',
        content: completedMarkdown,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain(
        'Successfully created note: stale-mock-mcp-entry-in-codex-config.md'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/stale-mock-mcp-entry-in-codex-config\.md$/),
        completedMarkdown,
        'utf-8'
      );
    });

    it('rejects template content when placeholders remain', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        `# Bug: [간단한 설명]

## 증상

- 에러 메시지: \`...\`
- 관찰된 동작: ...

## 원인

실제 원인 분석

## 해결

// 수정 코드

## 예방

향후 같은 문제를 방지하는 방법

## 관련 노트

- [[유사-버그.md]] / [[예방-패턴.md]]
` as never
      );

      const result = await handler({
        title: 'stale mock-mcp entry',
        template: 'bug',
        content: `# Bug: [간단한 설명]

## 증상

- 에러 메시지: \`...\`
- 관찰된 동작: ...

## 원인

실제 원인 분석

## 해결

// 수정 코드

## 예방

향후 같은 문제를 방지하는 방법

## 관련 노트

- [[유사-버그.md]]
`,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Template placeholder was not replaced');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects template content when a required heading is missing', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        `# ADR-NNN: [제목]

## 상태

Accepted | Deprecated | Superseded by [[ADR-YYY]]

## 맥락

이 결정을 내리게 된 배경/문제 상황

## 결정

무엇을 어떻게 하기로 했는지

## 결과

### 긍정적

- ...

### 부정적 (트레이드오프)

- ...

## 관련 노트

- [[관련-결정.md]] / [[관련-패턴.md]]
` as never
      );

      const result = await handler({
        title: 'adopt template-aware note validation',
        template: 'adr',
        content: `# ADR-001: Adopt template-aware note validation

## 상태

Accepted

## 맥락

템플릿 노트가 summary append 방식으로 깨지고 있다.

## 결과

### 긍정적

- 템플릿을 스펙으로 취급할 수 있다.

### 부정적 (트레이드오프)

- caller가 완성된 markdown을 써야 한다.

## 관련 노트

- [[pattern-template-validation]]
`,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Missing required heading: ## 결정');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects tags and linked_notes in template mode', async () => {
      const tagsResult = await handler({
        title: 'templated note',
        template: 'bug',
        content: '# Bug: templated note',
        tags: ['bug'],
      });

      expect(tagsResult.isError).toBe(true);
      expect(tagsResult.content[0].text).toContain('`tags` is not supported in template mode');

      const linkedNotesResult = await handler({
        title: 'templated note',
        template: 'bug',
        content: '# Bug: templated note',
        linked_notes: ['omx-setup'],
      });

      expect(linkedNotesResult.isError).toBe(true);
      expect(linkedNotesResult.content[0].text).toContain(
        '`linked_notes` is not supported in template mode'
      );
    });

    it('preserves non-template note creation behavior', async () => {
      const result = await handler({
        title: 'plain note',
        content: 'Body content',
        tags: ['alpha', 'beta'],
        linked_notes: ['related-note'],
      });

      expect(result.isError).toBeUndefined();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/plain-note\.md$/),
        expect.stringContaining('title: plain note'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/plain-note\.md$/),
        expect.stringContaining('## Related Notes'),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/plain-note\.md$/),
        expect.stringContaining('- [[related-note]]'),
        'utf-8'
      );
    });
  });

  describe('submit_turn_complete tool', () => {
    let toolDef: { inputSchema: Record<string, unknown> };
    let handler: ToolHandler;

    beforeEach(() => {
      const call = getRegisteredToolCall('submit_turn_complete');
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
