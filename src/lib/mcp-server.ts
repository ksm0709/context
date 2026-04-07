import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { loadConfig } from './config.js';
import { BUILTIN_SIGNALS, LIMITS } from '../constants.js';

const SESSION_ID = process.env.CLAUDE_SESSION_ID ?? process.env.OPENCODE_SESSION_ID ?? '';
const SIGNAL_TTL_MS = 60 * 60 * 1000; // 1 hour

function parseSignalFile(content: string): { sessionId: string; timestamp: number; caller: 'agent' | 'reviewer' } {
  const sessionMatch = content.match(/^session_id=(.*)$/m);
  const timestampMatch = content.match(/^timestamp=(\d+)$/m);
  const callerMatch = content.match(/^caller=(agent|reviewer)$/m);
  return {
    sessionId: sessionMatch?.[1]?.trim() ?? '',
    timestamp: timestampMatch ? parseInt(timestampMatch[1], 10) : 0,
    caller: (callerMatch?.[1] as 'agent' | 'reviewer') ?? 'agent',
  };
}

function guardSignalPath(signalPath: string): void {
  const normalized = signalPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized.startsWith('.context/') || normalized.includes('..')) {
    throw new Error(`Signal path must start with ".context/" (got: ${JSON.stringify(signalPath)})`);
  }
}

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
    'run_smoke_check',
    {
      description:
        'Run a named smoke check command defined in .context/config.jsonc and write a signal file on success. Call this before submit_turn_complete to satisfy configured checks.',
      inputSchema: {
        name: z
          .string()
          .describe(
            'The name of the smokeCheck entry to run (must match a smokeChecks[].name in config)'
          ),
        caller: z
          .enum(['agent', 'reviewer'])
          .optional()
          .describe(
            'Caller context. Use "reviewer" when invoked from a reviewer agent. Defaults to "agent".'
          ),
      },
    },
    async ({ name, caller }) => {
      try {
        const config = loadConfig(process.cwd());
        const smokeChecks = config.smokeChecks ?? [];
        const entry = smokeChecks.find((sc) => sc.name === name);

        if (!entry) {
          const available = smokeChecks.map((sc) => sc.name).join(', ') || '(none configured)';
          return {
            content: [
              {
                type: 'text',
                text: `Error: no smokeCheck named "${name}" found in .context/config.jsonc. Available: ${available}`,
              },
            ],
            isError: true,
          };
        }

        guardSignalPath(entry.signal);

        const entryType = entry.type ?? 'command';
        let cmd: string;
        if (entryType === 'agent') {
          if (!entry.prompt) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: smokeCheck "${name}" has type "agent" but no "prompt" field.`,
                },
              ],
              isError: true,
            };
          }
          const fullPrompt =
            entry.prompt +
            '\n\nIMPORTANT: You MUST output exactly PASS or FAIL as the very last line of your response. No other text on that line.';
          const escaped = fullPrompt.replace(/'/g, "'\\''");
          cmd = `claude -p '${escaped}' 2>&1 | tail -5 | grep -q 'PASS'`;
        } else {
          if (!entry.command) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: smokeCheck "${name}" has type "command" but no "command" field.`,
                },
              ],
              isError: true,
            };
          }
          cmd = entry.command;
        }

        try {
          execSync(cmd, {
            cwd: process.cwd(),
            timeout: entry.timeout ?? LIMITS.smokeCheckTimeout,
            stdio: 'pipe',
          });
        } catch (cmdError) {
          const msg = cmdError instanceof Error ? cmdError.message : String(cmdError);
          return {
            content: [
              {
                type: 'text',
                text: `Smoke check "${name}" failed: ${msg}`,
              },
            ],
            isError: true,
          };
        }

        const signalPath = path.resolve(process.cwd(), entry.signal);
        await fs.mkdir(path.dirname(signalPath), { recursive: true });
        const callerValue = caller ?? 'agent';
        const signalContent = `session_id=${SESSION_ID}\ntimestamp=${Date.now()}\ncaller=${callerValue}\n`;
        await fs.writeFile(signalPath, signalContent, 'utf-8');

        return {
          content: [
            {
              type: 'text',
              text: `Smoke check "${name}" passed. Signal written to ${entry.signal}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error running smoke check: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'check_hash',
    {
      description:
        'Verify all changes are committed. Errors if uncommitted changes exist, records the latest commit hash on success, or auto-passes if no code was changed this session.',
      inputSchema: {},
    },
    async () => {
      const signalPath = path.resolve(process.cwd(), BUILTIN_SIGNALS.hash);
      const skipContent = `session_id=${SESSION_ID}\ntimestamp=${Date.now()}\nskipped=true\n`;

      try {
        let status = '';
        try {
          status = execSync('git status --porcelain', {
            cwd: process.cwd(),
            timeout: 10_000,
            stdio: 'pipe',
          })
            .toString()
            .trim();
        } catch {
          // Not a git repo — auto-pass
          await fs.mkdir(path.dirname(signalPath), { recursive: true });
          await fs.writeFile(signalPath, skipContent, 'utf-8');
          return { content: [{ type: 'text', text: 'check_hash: skipped (not a git repo).' }] };
        }

        if (status) {
          return {
            content: [
              {
                type: 'text',
                text: `check_hash failed: uncommitted changes detected:\n${status}\n\nCommit or stash your changes before calling submit_turn_complete.`,
              },
            ],
            isError: true,
          };
        }

        let gitLog = '(no commits)';
        try {
          gitLog = execSync('git log -1 --oneline', { cwd: process.cwd(), stdio: 'pipe' })
            .toString()
            .trim();
        } catch {
          // no commits yet — still pass
        }

        await fs.mkdir(path.dirname(signalPath), { recursive: true });
        await fs.writeFile(
          signalPath,
          `session_id=${SESSION_ID}\ntimestamp=${Date.now()}\ngit_log=${gitLog}\n`,
          'utf-8'
        );
        return { content: [{ type: 'text', text: `check_hash passed. Commit: ${gitLog}` }] };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error running check_hash: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'check_scope',
    {
      description:
        'Record scope review notes confirming work stayed within intended boundaries. Always succeeds and writes a result file consumed by submit_turn_complete.',
      inputSchema: {
        notes: z
          .string()
          .describe(
            'Brief sentence confirming scope was not exceeded and work stayed within intended boundaries.'
          ),
      },
    },
    async ({ notes }) => {
      if (!notes || (notes as string).length < 10) {
        return {
          content: [{ type: 'text', text: 'Error: notes must be at least 10 characters.' }],
          isError: true,
        };
      }
      const signalPath = path.resolve(process.cwd(), BUILTIN_SIGNALS.scope);
      await fs.mkdir(path.dirname(signalPath), { recursive: true });
      await fs.writeFile(
        signalPath,
        `session_id=${SESSION_ID}\ntimestamp=${Date.now()}\nnotes=${notes}\n`,
        'utf-8'
      );
      return { content: [{ type: 'text', text: 'check_scope recorded.' }] };
    }
  );

  server.registerTool(
    'infer_smoke_checks',
    {
      description:
        '[experimental] Analyze the current project and infer appropriate smoke checks. ' +
        'Writes checks and smokeChecks to .context/config.jsonc permanently. ' +
        'Idempotent: if checks or smokeChecks are already configured, returns early. ' +
        'Requires claude CLI to be available on PATH.',
      inputSchema: {},
    },
    async () => {
      try {
        const config = loadConfig(process.cwd());
        if ((config.checks ?? []).length > 0 || (config.smokeChecks ?? []).length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Checks already configured. No inference needed. To re-infer, clear checks/smokeChecks from .context/config.jsonc first.',
              },
            ],
          };
        }

        const { inferAndPersistChecks } = await import('./config.js');
        const result = await inferAndPersistChecks(process.cwd());
        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: 'Could not infer checks (analysis failed or claude CLI unavailable). Configure manually in .context/config.jsonc.',
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Inferred and saved ${result.checks.length} check(s): ${result.checks.map((c) => c.name).join(', ')}. Run run_smoke_check() for each, then submit_turn_complete.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
      description:
        'Mark the current turn as complete after verifying all quality gate signal files (built-in: check_hash + check_scope, plus any configured smoke checks) are present and fresh.',
      inputSchema: {},
    },
    async () => {
      const now = Date.now();
      const signalErrors: string[] = [];

      // Helper: validate a single signal file
      async function validateSignal(name: string, signal: string, retryTool: string) {
        try {
          const signalPath = path.resolve(process.cwd(), signal);
          const raw = await fs.readFile(signalPath, 'utf-8');
          const { sessionId, timestamp } = parseSignalFile(raw);

          if (timestamp === 0) {
            signalErrors.push(`"${name}": signal file has no valid timestamp`);
            return;
          }
          if (now - timestamp > SIGNAL_TTL_MS) {
            signalErrors.push(
              `"${name}": signal file is stale (age: ${Math.round((now - timestamp) / 60_000)}min, TTL: 60min). Re-run ${retryTool}.`
            );
            return;
          }
          if (SESSION_ID && sessionId && sessionId !== SESSION_ID) {
            signalErrors.push(
              `"${name}": signal file is from a different session. Re-run ${retryTool}.`
            );
          }
        } catch (err) {
          if ((err as { code?: string }).code === 'ENOENT') {
            signalErrors.push(`"${name}": signal file not found. Run ${retryTool} first.`);
          } else {
            signalErrors.push(`"${name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Built-in checks
      await validateSignal('check_hash', BUILTIN_SIGNALS.hash, 'check_hash()');
      await validateSignal('check_scope', BUILTIN_SIGNALS.scope, 'check_scope()');

      // Config-defined checks
      const config = loadConfig(process.cwd());
      const configuredChecks = config.checks ?? [];

      if (configuredChecks.length === 0) {
        // No smoke checks configured — warn but allow submission
        return {
          content: [
            {
              type: 'text',
              text: 'Warning: no quality checks configured. Call infer_smoke_checks() to auto-configure, or add checks/smokeChecks to .context/config.jsonc. Proceeding without smoke check validation.',
            },
          ],
        };
      }

      for (const check of configuredChecks) {
        try {
          guardSignalPath(check.signal);
        } catch (e) {
          signalErrors.push(`"${check.name}": ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        await validateSignal(check.name, check.signal, `run_smoke_check("${check.name}")`);
      }

      if (signalErrors.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: quality gate checks failed:\n${signalErrors.map((e) => `- ${e}`).join('\n')}`,
            },
          ],
          isError: true,
        };
      }

      try {
        const dirPath = path.resolve(process.cwd(), '.context');
        const filePath = path.join(dirPath, '.work-complete');
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, `session_id=${SESSION_ID}\ntimestamp=${Date.now()}\n`, 'utf-8');
        return { content: [{ type: 'text', text: 'Turn successfully marked as complete.' }] };
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
