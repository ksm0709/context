import { existsSync } from 'node:fs';

import { loadConfig } from '../lib/config.js';
import { findGitRoot, resolveProjectPaths } from '../lib/project-root.js';
import { scaffoldIfNeeded } from '../lib/scaffold.js';
import { injectIntoAgentsMd } from '../shared/agents-md.js';
import { pruneStaleMockMcpServer } from '../shared/codex-settings.js';
import { injectIntoGlobalInstructions } from '../shared/global-instructions.js';
import { STATIC_WORKFLOW_CONTEXT } from '../shared/workflow-context.js';
import { ensureMcpRegistered } from './registry.js';

interface OmxHookContext {
  projectDir?: string;
  directory?: string;
  session_name?: string;
  [key: string]: unknown;
}

interface OmxHookEvent {
  event: string;
  context?: OmxHookContext;
  session_id?: string;
  thread_id?: string;
  turn_id?: string;
}

interface OmxSendKeysOptions {
  paneId?: string;
  sessionName?: string;
  text: string;
  submit?: boolean;
  cooldownMs?: number;
}

interface OmxSendKeysResult {
  ok: boolean;
  reason: string;
  target?: string;
  paneId?: string;
  error?: string;
}

interface OmxSdk {
  log: {
    info: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
    warn?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
    error?: (message: string, meta?: Record<string, unknown>) => void | Promise<void>;
  };
  state?: {
    read?: <T = unknown>(key: string, fallback?: T) => Promise<T | undefined>;
    write?: (key: string, value: unknown) => Promise<void>;
  };
}

function resolveProjectDir(event: OmxHookEvent): string {
  return event.context?.projectDir ?? event.context?.directory ?? process.cwd();
}

async function onSessionStart(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  const projectDir = resolveProjectDir(event);
  const paths = resolveProjectPaths(projectDir);

  if (pruneStaleMockMcpServer()) {
    await sdk.log.info(
      'Removed stale mock-mcp from ~/.codex/config.toml because its target file is missing.'
    );
  }

  scaffoldIfNeeded(paths.contextParent);

  injectIntoAgentsMd(paths.agentsMdPath, STATIC_WORKFLOW_CONTEXT);
  injectIntoAgentsMd(paths.claudeMdPath, STATIC_WORKFLOW_CONTEXT);

  // Non-git fallback: inject into Codex's global instructions (~/.codex/instructions.md)
  // so instructions are available even when running from home or non-git directories
  if (!findGitRoot(projectDir)) {
    injectIntoGlobalInstructions('codex', STATIC_WORKFLOW_CONTEXT);
  }

  await sdk.log.info(`Injected context into AGENTS.md for ${projectDir}`);

  const wasRegistered = ensureMcpRegistered(sdk.log.info);
  if (wasRegistered) {
    const warningMsg =
      "Context MCP was just added to your OMX registry. You must stop this session, run 'omx setup', and restart to use MCP tools.";
    await sdk.log.info(warningMsg);
  }
}

export async function onHookEvent(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  if (event.event === 'session-start') {
    await onSessionStart(event, sdk);
    return;
  }
}

// Re-export interfaces for external consumers
export type { OmxSendKeysOptions, OmxSendKeysResult };
