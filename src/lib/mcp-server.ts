import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';

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
      description: 'Search .md files in docs/ and .context/ directories for a keyword or regex',
      inputSchema: {
        query: z.string().describe('The keyword or regex to search for'),
        limit: z.number().optional().default(50).describe('Maximum number of results to return'),
      },
    },
    async ({ query, limit = 50 }) => {
      const searchDirs = ['docs', '.context'];
      const results: { file: string; snippet: string }[] = [];
      const maxResults = limit;
      const snippetLength = 100;

      try {
        const regex = new RegExp(query, 'i');

        for (const dir of searchDirs) {
          const fullDirPath = path.resolve(process.cwd(), dir);
          try {
            const files = await fs.readdir(fullDirPath, { recursive: true });
            for (const file of files) {
              if (typeof file === 'string' && file.endsWith('.md')) {
                const filePath = path.join(fullDirPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const match = regex.exec(content);

                if (match) {
                  const start = Math.max(0, match.index - snippetLength / 2);
                  const end = Math.min(
                    content.length,
                    match.index + match[0].length + snippetLength / 2
                  );
                  let snippet = content.substring(start, end).replace(/\n/g, ' ');
                  if (start > 0) snippet = '...' + snippet;
                  if (end < content.length) snippet = snippet + '...';

                  results.push({
                    file: path.relative(process.cwd(), filePath),
                    snippet,
                  });

                  if (results.length >= maxResults) {
                    break;
                  }
                }
              }
            }
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
              console.error(`Error reading directory ${dir}:`, err);
            }
          }
          if (results.length >= maxResults) {
            break;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text:
                results.length > 0
                  ? results.map((r) => `File: ${r.file}\nSnippet: ${r.snippet}`).join('\n\n')
                  : 'No matches found.',
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
      description: 'Read the content of a specific .md file in docs/ or .context/ directories',
      inputSchema: {
        path: z.string().describe('The relative path to the file (e.g., docs/architecture.md)'),
      },
    },
    async ({ path: filePath }) => {
      try {
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
          throw new Error('Invalid path: Directory traversal is not allowed');
        }

        if (!normalizedPath.startsWith('docs/') && !normalizedPath.startsWith('.context/')) {
          throw new Error('Invalid path: Only files in docs/ or .context/ are allowed');
        }

        const fullPath = path.resolve(process.cwd(), normalizedPath);
        const content = await fs.readFile(fullPath, 'utf-8');

        const MAX_LENGTH = 32 * 1024;
        const truncatedContent =
          content.length > MAX_LENGTH
            ? content.substring(0, MAX_LENGTH) + '\n\n... (content truncated due to size limit)'
            : content;

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
        } catch (err) {}

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
        days_before: z.number().optional().default(0).describe('Number of days ago (0 for today)'),
        offset: z
          .number()
          .optional()
          .default(0)
          .describe('Line number to start reading from (0-indexed)'),
        lines: z.number().optional().default(100).describe('Number of lines to read'),
      },
    },
    async ({ days_before, offset, lines }) => {
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
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
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
          } catch (err) {}

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
        daily_note_updated: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            '데일리 노트에 중요한 컨텍스트를 기록하여 다음 세션이나 에이전트 팀이 참고할 수 있도록 하세요. 기존 내용 수정은 불가하며, 새로운 메모를 추가 하는것만 가능합니다. 참고 가이드: .context/guides/daily-note-guide.md 파일을 읽고 지침을 따르세요. 실제로 도구를 사용해 노트를 작성했거나 검증을 수행한 경우에만 true로 설정하세요. 거짓으로 true를 입력하지 마세요. (Set to true ONLY if you actually performed this action. Do not fake it.)'
          ),
        knowledge_note_created: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            '작업기억(데일리노트, 세션 컨텍스트)보다 오래 기억되어야 하는 중요한 결정, 패턴, 실수, 발견은 지식 노트로 기록하여 프로젝트의 집단 지식으로 남기세요. 참고 가이드: .context/guides/note-guide.md 파일을 읽고 지침을 따르세요. 실제로 도구를 사용해 노트를 작성했거나 검증을 수행한 경우에만 true로 설정하세요. 거짓으로 true를 입력하지 마세요. (Set to true ONLY if you actually performed this action. Do not fake it.)'
          ),
        quality_check_passed: z
          .boolean()
          .describe(
            '작업 완료 전에 반드시 수행하세요. 코드 린트, 포맷터, 테스트, 빌드, 코드리뷰를 실행하여 작업 결과물이 프로젝트의 품질 기준을 충족하는지 확인하세요. 참고 가이드: .context/guides/quality-check.md 파일을 읽고 지침을 따르세요. 실제로 도구를 사용해 노트를 작성했거나 검증을 수행한 경우에만 true로 설정하세요. 거짓으로 true를 입력하지 마세요. (Set to true ONLY if you actually performed this action. Do not fake it.)'
          ),
        checkpoints_committed: z
          .boolean()
          .describe(
            '작업이 길어질 경우, 중요한 단계마다 체크포인트 커밋을 하여 작업 내용을 안전하게 저장하고, 필요 시 이전 상태로 돌아갈 수 있도록 하세요. 참고 가이드: .context/guides/commit-guide.md 파일을 읽고 지침을 따르세요. 실제로 도구를 사용해 노트를 작성했거나 검증을 수행한 경우에만 true로 설정하세요. 거짓으로 true를 입력하지 마세요. (Set to true ONLY if you actually performed this action. Do not fake it.)'
          ),
        scope_reviewed: z
          .boolean()
          .describe(
            '사용자가 의도한 작업 범위를 벗어나지 않았는지, 작업이 너무 크거나 복잡해지지는 않았는지 검토하세요. 참고 가이드: .context/guides/scope-review.md 파일을 읽고 지침을 따르세요. 실제로 도구를 사용해 노트를 작성했거나 검증을 수행한 경우에만 true로 설정하세요. 거짓으로 true를 입력하지 마세요. (Set to true ONLY if you actually performed this action. Do not fake it.)'
          ),
      },
    },
    async ({
      daily_note_updated = false,
      knowledge_note_created = false,
      quality_check_passed,
      checkpoints_committed,
      scope_reviewed,
    }) => {
      const missingSteps: string[] = [];
      const warnings: string[] = [];

      if (daily_note_updated === false)
        warnings.push(
          'Warning: Daily note was skipped. This is allowed, but ensure no important context is lost.'
        );
      if (knowledge_note_created === false)
        warnings.push(
          'Warning: Knowledge note was skipped. This is allowed, but ensure no important context is lost.'
        );

      if (!quality_check_passed) missingSteps.push('quality_check_passed');
      if (!checkpoints_committed) missingSteps.push('checkpoints_committed');
      if (!scope_reviewed) missingSteps.push('scope_reviewed');

      if (missingSteps.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: The following required steps were not completed: ${missingSteps.join(', ')}. You must complete all steps before finishing the turn.`,
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

  const transport = new StdioServerTransport();
  server.connect(transport);
  return server;
}
