import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { DEFAULTS } from '../constants.js';
import { loadConfig } from '../lib/config.js';
import { resolveContextDir } from '../lib/context-dir.js';
import {
  buildKnowledgeIndexV2,
  formatDomainIndex,
  formatKnowledgeIndex,
} from '../lib/knowledge-index.js';
import { readPromptFile, resolvePromptVariables } from '../lib/prompt-reader.js';
import { scaffoldIfNeeded } from '../lib/scaffold.js';
import type { ContextConfig } from '../types.js';
import { injectIntoAgentsMd } from './agents-md.js';
import { sendTmuxSubmitSequence } from './tmux-submit.js';

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
  tmux?: {
    sendKeys?: (options: OmxSendKeysOptions) => Promise<OmxSendKeysResult>;
  };
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

const TURN_END_STATE_KEY = 'last_turn_end_turn_id';
const TURN_END_PENDING_SKIP_KEY = 'turn_end_pending_followup_scopes';

interface PendingFollowupScope {
  sourceTurnId: string;
  createdAt: number;
}

function parseWorkComplete(content: string): { sessionId?: string; turnId?: string } {
  const result: { sessionId?: string; turnId?: string } = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('session_id=')) {
      result.sessionId = trimmed.substring('session_id='.length).trim();
    } else if (trimmed.startsWith('turn_id=')) {
      result.turnId = trimmed.substring('turn_id='.length).trim();
    }
  }
  return result;
}

function clearCurrentFollowupScope(
  pendingScopes: Record<string, PendingFollowupScope>,
  scopeKey: string | null
): Record<string, PendingFollowupScope> {
  if (!scopeKey || !pendingScopes[scopeKey]) {
    return pendingScopes;
  }
  const nextScopes = { ...pendingScopes };
  delete nextScopes[scopeKey];
  return nextScopes;
}

function resolveProjectDir(event: OmxHookEvent): string {
  return event.context?.projectDir ?? event.context?.directory ?? process.cwd();
}

function resolvePromptPath(directory: string, contextDir: string, promptPath: string): string {
  if (isAbsolute(promptPath)) return promptPath;
  if (promptPath.startsWith('.context/') || promptPath.startsWith('.opencode/')) {
    return join(directory, promptPath);
  }
  return join(directory, contextDir, promptPath);
}

function buildPromptVars(config: ContextConfig): { knowledgeDir: string } {
  return { knowledgeDir: config.knowledge.dir ?? DEFAULTS.knowledgeDir };
}

function buildKnowledgeContent(projectDir: string, config: ContextConfig): string {
  const knowledgeIndex = buildKnowledgeIndexV2(projectDir, config.knowledge);
  return knowledgeIndex.mode === 'flat'
    ? formatKnowledgeIndex(knowledgeIndex.individualFiles)
    : formatDomainIndex(knowledgeIndex);
}

function resolveFollowupScopeKey(event: OmxHookEvent): string | null {
  if (event.session_id && event.session_id.trim().length > 0) {
    return `session:${event.session_id.trim()}`;
  }

  if (event.thread_id && event.thread_id.trim().length > 0) {
    return `thread:${event.thread_id.trim()}`;
  }

  return null;
}

async function logWarn(
  sdk: OmxSdk,
  message: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  if (typeof sdk.log.warn === 'function') {
    await sdk.log.warn(message, meta);
    return;
  }

  await sdk.log.info(message, meta);
}

async function onSessionStart(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  const projectDir = resolveProjectDir(event);
  const contextDir = resolveContextDir(projectDir);

  scaffoldIfNeeded(projectDir);

  const config = loadConfig(projectDir);
  const promptVars = buildPromptVars(config);
  const turnStartPath = resolvePromptPath(
    projectDir,
    contextDir,
    config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile)
  );
  const turnStart = resolvePromptVariables(readPromptFile(turnStartPath), promptVars);
  const indexContent = buildKnowledgeContent(projectDir, config);
  const combinedContent = [turnStart, indexContent].filter(Boolean).join('\n\n');

  if (!combinedContent) {
    return;
  }

  injectIntoAgentsMd(join(projectDir, 'AGENTS.md'), combinedContent);
  await sdk.log.info(`Injected context into AGENTS.md for ${projectDir}`);
}

async function onTurnComplete(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  const projectDir = resolveProjectDir(event);
  const contextDir = resolveContextDir(projectDir);
  const config = loadConfig(projectDir);
  const strategy = config.omx?.turnEnd?.strategy ?? 'off';

  if (strategy !== 'turn-complete-sendkeys') {
    return;
  }

  if (process.env.OMX_TEAM_WORKER) {
    await logWarn(sdk, 'turn_end_skipped_team_worker', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
    });
    return;
  }

  if (!event.turn_id) {
    await logWarn(sdk, 'turn_end_skipped_missing_turn_id', {
      event: event.event,
      session_id: event.session_id,
    });
    return;
  }

  const followupScopeKey = resolveFollowupScopeKey(event);
  let pendingFollowupScopes =
    typeof sdk.state?.read === 'function'
      ? ((await sdk.state.read<Record<string, PendingFollowupScope>>(
          TURN_END_PENDING_SKIP_KEY,
          {}
        )) ?? {})
      : {};

  const workCompleteFile = join(projectDir, DEFAULTS.workCompleteFile);
  if (existsSync(workCompleteFile)) {
    const content = readFileSync(workCompleteFile, 'utf-8');
    const { sessionId: fileSessionId, turnId: fileTurnId } = parseWorkComplete(content);
    const currentScopeId = event.session_id ?? event.thread_id ?? '';

    if (!fileSessionId || fileSessionId === currentScopeId) {
      pendingFollowupScopes = clearCurrentFollowupScope(pendingFollowupScopes, followupScopeKey);

      if (fileTurnId === event.turn_id) {
        if (typeof sdk.state?.write === 'function') {
          await sdk.state.write(TURN_END_PENDING_SKIP_KEY, pendingFollowupScopes);
        }
        await sdk.log.info('turn_end_skipped_work_complete', {
          event: event.event,
          session_id: event.session_id,
          turn_id: event.turn_id,
        });
        return;
      }

      unlinkSync(workCompleteFile);
      if (typeof sdk.state?.write === 'function') {
        await sdk.state.write(TURN_END_PENDING_SKIP_KEY, pendingFollowupScopes);
      }
      await sdk.log.info('turn_end_work_complete_cleared', {
        event: event.event,
        session_id: event.session_id,
        turn_id: event.turn_id,
        cleared_turn_id: fileTurnId,
      });
    }
  }

  if (followupScopeKey && pendingFollowupScopes[followupScopeKey]) {
    const nextPendingScopes = { ...pendingFollowupScopes };
    delete nextPendingScopes[followupScopeKey];

    if (typeof sdk.state?.write === 'function') {
      await sdk.state.write(TURN_END_PENDING_SKIP_KEY, nextPendingScopes);
    }

    await sdk.log.info('turn_end_skipped_followup_turn', {
      event: event.event,
      session_id: event.session_id,
      thread_id: event.thread_id,
      turn_id: event.turn_id,
      scope_key: followupScopeKey,
    });
    return;
  }

  const lastTurnID =
    typeof sdk.state?.read === 'function'
      ? await sdk.state.read<string>(TURN_END_STATE_KEY)
      : undefined;
  if (lastTurnID === event.turn_id) {
    await sdk.log.info('turn_end_skipped_duplicate_turn', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
    });
    return;
  }

  const promptVars = {
    ...buildPromptVars(config),
    sessionId: event.session_id ?? event.thread_id ?? 'unknown',
    turnId: event.turn_id ?? '',
  };
  const turnEndPath = resolvePromptPath(
    projectDir,
    contextDir,
    config.prompts.turnEnd ?? join(DEFAULTS.promptDir, DEFAULTS.turnEndFile)
  );
  const turnEndRaw = readPromptFile(turnEndPath);
  if (!turnEndRaw) {
    await sdk.log.info('turn_end_skipped_empty_prompt', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
    });
    return;
  }

  if (typeof sdk.tmux?.sendKeys !== 'function') {
    await logWarn(sdk, 'turn_end_sendkeys_failed', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
      reason: 'tmux_sendkeys_unavailable',
    });
    return;
  }

  const turnEnd = resolvePromptVariables(turnEndRaw, promptVars);
  const reminderText = `<system-reminder>\n${turnEnd}\n</system-reminder>`;
  const sessionName =
    typeof event.context?.session_name === 'string' && event.context.session_name.trim().length > 0
      ? event.context.session_name.trim()
      : undefined;
  const result = await sdk.tmux.sendKeys({
    sessionName,
    text: reminderText,
    submit: false,
  });

  if (!result.ok) {
    await logWarn(sdk, 'turn_end_sendkeys_failed', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
      reason: result.reason,
      target: result.target,
      error: result.error,
    });
    return;
  }

  const submitTarget = result.paneId ?? result.target;
  if (!submitTarget) {
    await logWarn(sdk, 'turn_end_sendkeys_failed', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
      reason: 'missing_submit_target',
    });
    return;
  }

  const submitResult = await sendTmuxSubmitSequence(submitTarget);
  if (!submitResult.ok) {
    await logWarn(sdk, 'turn_end_sendkeys_failed', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
      reason: 'submit_sequence_failed',
      target: submitTarget,
      error: submitResult.error,
      submit_attempts: submitResult.attempts,
    });
    return;
  }

  if (typeof sdk.state?.write === 'function') {
    await sdk.state.write(TURN_END_STATE_KEY, event.turn_id);
    if (followupScopeKey) {
      await sdk.state.write(TURN_END_PENDING_SKIP_KEY, {
        ...pendingFollowupScopes,
        [followupScopeKey]: {
          sourceTurnId: event.turn_id,
          createdAt: Date.now(),
        },
      });
    }
  }

  await sdk.log.info('turn_end_submit_sequence_sent', {
    event: event.event,
    session_id: event.session_id,
    turn_id: event.turn_id,
    target: submitTarget,
    submit_attempts: submitResult.attempts,
  });

  await sdk.log.info('turn_end_sent', {
    event: event.event,
    session_id: event.session_id,
    turn_id: event.turn_id,
    target: result.target,
    pane_id: result.paneId,
  });
}

export async function onHookEvent(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  if (event.event === 'session-start') {
    await onSessionStart(event, sdk);
    return;
  }

  if (event.event === 'turn-complete') {
    await onTurnComplete(event, sdk);
  }
}
