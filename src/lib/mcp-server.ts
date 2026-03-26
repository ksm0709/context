import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  buildReadKnowledgeResponse,
  buildSearchKnowledgeResponse,
  formatRelatedNotesSection,
  loadKnowledgeNotes,
  normalizeKnowledgePath,
  resolveRelatedKnowledgeLinks,
  searchKnowledgeNotes,
} from './knowledge-search.js';

export function startMcpServer() {
  const server = new McpServer(
    {
      name: 'context-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  server.registerTool(
    'search_knowledge',
    {
      description:
        'Search knowledge notes in docs/ and .context/ using weighted metadata/body matching and ranked results',
      inputSchema: {
        query: z
          .string()
          .describe(
            'The search query to match against titles, descriptions, tags, and note content'
          ),
        limit: z.number().optional().describe('Maximum number of results to return (default: 50)'),
      },
    },
    async ({ query, limit = 50 }) => {
      try {
        const notes = await loadKnowledgeNotes(process.cwd());
        const results = searchKnowledgeNotes(notes, query, limit);

        return {
          content: [
            {
              type: 'text',
              text: buildSearchKnowledgeResponse(results),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error searching knowledge: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'read_knowledge',
    {
      description:
        'Read a specific knowledge note and append linked-note metadata to help agents explore related notes',
      inputSchema: {
        path: z.string().describe('The relative path to the file (e.g., docs/architecture.md)'),
      },
    },
    async ({ path: filePath }) => {
      try {
        const normalizedPath = normalizeKnowledgePath(filePath);

        const fullPath = path.resolve(process.cwd(), normalizedPath);
        const notes = await loadKnowledgeNotes(process.cwd());
        const note = notes.find((entry) => entry.file === normalizedPath);
        const content = note?.content ?? (await fs.readFile(fullPath, 'utf-8'));
        const relatedNotesSection = note
          ? formatRelatedNotesSection(resolveRelatedKnowledgeLinks(notes, note.file, note.links))
          : '';
        const truncatedContent = buildReadKnowledgeResponse(content, relatedNotesSection);

        return {
          content: [
            {
              type: 'text',
              text: truncatedContent,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error reading knowledge: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'append_daily_note',
    {
      description:
        "Append text to the current day's daily note, creating the file if it doesn't exist",
      inputSchema: {
        content: z.string().describe('The text content to append to the daily note'),
      },
    },
    async ({ content }) => {
      try {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        const timestamp = `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;

        const dirPath = path.resolve(process.cwd(), '.context/memory/daily');
        const filePath = path.join(dirPath, `${dateString}.md`);

        await fs.mkdir(dirPath, { recursive: true });

        let textToAppend = content;
        if (!content.startsWith(`[${year}-${month}-${day}`)) {
          textToAppend = `${timestamp} ${content}`;
        }

        try {
          const existingContent = await fs.readFile(filePath, 'utf-8');
          if (existingContent.length > 0 && !existingContent.endsWith('\n')) {
            textToAppend = '\n' + textToAppend;
          }
        } catch {
          // ignore error if file doesn't exist
        }

        if (!textToAppend.endsWith('\n')) {
          textToAppend += '\n';
        }

        await fs.appendFile(filePath, textToAppend, 'utf-8');

        return {
          content: [
            {
              type: 'text',
              text: `Successfully appended to ${dateString}.md`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error appending to daily note: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'read_daily_note',
    {
      description: 'Read a daily note from N days ago',
      inputSchema: {
        days_before: z.number().optional().describe('Number of days ago (0 for today, default: 0)'),
        offset: z
          .number()
          .optional()
          .describe('Line number to start reading from (0-indexed, default: 0)'),
        lines: z.number().optional().describe('Number of lines to read (default: 100)'),
      },
    },
    async ({ days_before: _days_before, offset: _offset, lines: _lines }) => {
      const days_before = _days_before ?? 0;
      const offset = _offset ?? 0;
      const lines = _lines ?? 100;
      try {
        const date = new Date();
        date.setDate(date.getDate() - days_before);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const filePath = path.resolve(process.cwd(), '.context/memory/daily', `${dateString}.md`);

        let fileContent: string;
        try {
          fileContent = await fs.readFile(filePath, 'utf-8');
        } catch (err) {
          if ((err as { code?: string }).code === 'ENOENT') {
            return {
              content: [
                {
                  type: 'text',
                  text: `Daily note for ${dateString} does not exist.`,
                },
              ],
            };
          }
          throw err;
        }

        const contentLines = fileContent.split('\n');
        const selectedLines = contentLines.slice(offset, offset + lines);
        const resultText = selectedLines.join('\n');

        return {
          content: [
            {
              type: 'text',
              text: resultText || '(empty)',
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error reading daily note: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'create_knowledge_note',
    {
      description:
        'Create a new Zettelkasten knowledge note with frontmatter and wikilinks. You can optionally use a template by providing the `template` parameter. Available templates: adr (Architecture Decision Records), pattern (Design patterns), bug (Bug reports and analysis), gotcha (Pitfalls and gotchas), decision (General decisions), context (General context and background), runbook (Procedures and runbooks), insight (Insights and learnings).',
      inputSchema: {
        title: z.string().describe('The title of the note'),
        content: z.string().describe('The main content of the note'),
        tags: z.array(z.string()).optional().describe('Optional tags for the note'),
        linked_notes: z
          .array(z.string())
          .optional()
          .describe('Optional list of related note titles to link to'),
        template: z
          .enum(['adr', 'pattern', 'bug', 'gotcha', 'decision', 'context', 'runbook', 'insight'])
          .optional()
          .describe('Optional template to use for the note'),
      },
    },
    async ({ title, content, tags, linked_notes, template }) => {
      try {
        const filename =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '.md';
        const dirPath = path.resolve(process.cwd(), '.context/memory');
        const filePath = path.join(dirPath, filename);

        await fs.mkdir(dirPath, { recursive: true });

        const date = new Date().toISOString().split('T')[0];

        let fileContent = '';
        if (template) {
          const templatePath = path.resolve(process.cwd(), `.context/templates/${template}.md`);
          try {
            fileContent = await fs.readFile(templatePath, 'utf-8');
            fileContent = fileContent.replace(/\[제목\]/g, title);
            fileContent += `\n\n${content}`;
          } catch (err) {
            fileContent = `Error loading template: ${err instanceof Error ? err.message : String(err)}\n\n${content}`;
          }
        } else {
          fileContent = `---\n`;
          fileContent += `title: ${title}\n`;
          fileContent += `date: ${date}\n`;
          if (tags && tags.length > 0) {
            fileContent += `tags:\n${tags.map((t) => `  - ${t}`).join('\n')}\n`;
          }
          fileContent += `---\n\n`;
          fileContent += `# ${title}\n\n`;
          fileContent += `${content}\n`;
        }

        if (linked_notes && linked_notes.length > 0) {
          fileContent += `\n## Related Notes\n\n`;
          fileContent += linked_notes.map((note) => `- [[${note}]]`).join('\n') + '\n';
        }

        await fs.writeFile(filePath, fileContent, 'utf-8');

        return {
          content: [
            {
              type: 'text',
              text: `Successfully created note: ${filename}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating knowledge note: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'update_knowledge_note',
    {
      description: 'Update an existing knowledge note by appending or replacing content',
      inputSchema: {
        path: z
          .string()
          .describe('The relative path to the file (e.g., .context/memory/my-note.md)'),
        content: z.string().describe('The content to append or replace'),
        mode: z
          .enum(['append', 'replace'])
          .describe('Whether to append to or replace the existing content'),
      },
    },
    async ({ path: filePath, content, mode }) => {
      try {
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
          throw new Error('Invalid path: Directory traversal is not allowed');
        }

        if (!normalizedPath.startsWith('docs/') && !normalizedPath.startsWith('.context/')) {
          throw new Error('Invalid path: Only files in docs/ or .context/ are allowed');
        }

        const fullPath = path.resolve(process.cwd(), normalizedPath);

        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        if (mode === 'append') {
          let textToAppend = content;
          try {
            const existingContent = await fs.readFile(fullPath, 'utf-8');
            if (existingContent.length > 0 && !existingContent.endsWith('\n')) {
              textToAppend = '\n' + textToAppend;
            }
          } catch {
            // ignore error if file doesn't exist
          }

          if (!textToAppend.endsWith('\n')) {
            textToAppend += '\n';
          }

          await fs.appendFile(fullPath, textToAppend, 'utf-8');
        } else {
          await fs.writeFile(fullPath, content, 'utf-8');
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated note: ${normalizedPath} (mode: ${mode})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating knowledge note: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'submit_turn_complete',
    {
      description: 'Mark the current turn as complete after verifying all required steps',
      inputSchema: {
        daily_note_update_proof: z
          .string()
          .optional()
          .describe(
            "Provide the file path of the updated daily note, or explicitly write 'skipped' if no update was needed."
          ),
        knowledge_note_proof: z
          .string()
          .optional()
          .describe(
            "Provide the file path of the created knowledge note, or explicitly write 'skipped' if no note was created."
          ),
        quality_check_output: z
          .string()
          .describe(
            'Provide the last 5 lines of the `mise run lint && mise run test` execution output to prove quality checks passed.'
          ),
        checkpoint_commit_hashes: z
          .string()
          .describe(
            'Provide the output of `git log -1 --oneline` or an explanation if the task was too small for checkpoints.'
          ),
        scope_review_notes: z
          .string()
          .describe(
            'Provide a brief sentence confirming the scope check and that the work did not exceed the intended boundaries.'
          ),
      },
    },
    async ({
      daily_note_update_proof,
      knowledge_note_proof,
      quality_check_output,
      checkpoint_commit_hashes,
      scope_review_notes,
    }) => {
      const missingSteps: string[] = [];
      const warnings: string[] = [];

      if (!daily_note_update_proof || daily_note_update_proof.toLowerCase() === 'skipped') {
        warnings.push(
          'Warning: Daily note was skipped. This is allowed, but ensure no important context is lost.'
        );
      } else if (daily_note_update_proof.length < 5) {
        missingSteps.push('daily_note_update_proof (too short)');
      }

      if (!knowledge_note_proof || knowledge_note_proof.toLowerCase() === 'skipped') {
        warnings.push(
          'Warning: Knowledge note was skipped. This is allowed, but ensure no important context is lost.'
        );
      } else if (knowledge_note_proof.length < 5) {
        missingSteps.push('knowledge_note_proof (too short)');
      }

      if (!quality_check_output || quality_check_output.length < 20)
        missingSteps.push('quality_check_output');
      if (!checkpoint_commit_hashes || checkpoint_commit_hashes.length < 7)
        missingSteps.push('checkpoint_commit_hashes');
      if (!scope_review_notes || scope_review_notes.length < 10)
        missingSteps.push('scope_review_notes');

      if (missingSteps.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: The following required steps were not completed or provided insufficient proof: ${missingSteps.join(', ')}. You must provide valid proof for all steps before finishing the turn.`,
            },
          ],
          isError: true,
        };
      }

      try {
        const dirPath = path.resolve(process.cwd(), '.context');
        const filePath = path.join(dirPath, '.work-complete');

        await fs.mkdir(dirPath, { recursive: true });

        const content = `timestamp=${Date.now()}\n`;
        await fs.writeFile(filePath, content, 'utf-8');

        return {
          content: [
            {
              type: 'text',
              text: `Turn successfully marked as complete.${warnings.length > 0 ? '\n\n' + warnings.join('\n') : ''}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating .work-complete file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // === OMX(codex) 호환성을 위한 패치 ===
  // codex는 strict JSON 파싱을 하므로 최신 SDK가 추가하는 execution 필드나 $schema를 인식하지 못하고 툴을 드롭합니다.
  const listToolsMethod = ListToolsRequestSchema.shape.method.value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalListToolsHandler = (server.server as any)._requestHandlers?.get(listToolsMethod);

  if (originalListToolsHandler) {
    server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
      const response = await originalListToolsHandler(request, extra);
      if (response.tools) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.tools = response.tools.map((tool: any) => {
          const newTool = { ...tool };
          // codex 파서를 터뜨리는 호환성 파괴 필드들 제거
          delete newTool.execution;
          if (newTool.inputSchema && newTool.inputSchema.$schema) {
            delete newTool.inputSchema.$schema;
          }
          return newTool;
        });
      }
      return response;
    });
  }
  // ===================================

  // Codex CLI's Rust parser uses #[serde(deny_unknown_fields)] and rejects
  // the "listChanged" field that McpServer auto-injects into capabilities.
  // Override it to an empty object so Codex can parse the init response.
  const rawServer = (
    server as unknown as { server: { _capabilities: { tools?: Record<string, unknown> } } }
  ).server;
  if (rawServer._capabilities?.tools) {
    rawServer._capabilities.tools = {};
  }

  const transport = new StdioServerTransport();
  server.connect(transport);
  return server;
}
