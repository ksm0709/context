import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULTS } from '../constants.js';
import { loadConfig } from '../lib/config.js';
import { scaffoldIfNeeded } from '../lib/scaffold.js';
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

const STATIC_KNOWLEDGE_CONTEXT = `## Knowledge Context

이 프로젝트는 **제텔카스텐(Zettelkasten)** 방식으로 지식을 관리합니다.
세션 간 컨텍스트를 보존하여, 이전 세션의 결정/패턴/실수가 다음 세션에서 재활용됩니다.

### 제텔카스텐 핵심 원칙
1. **원자성** -- 하나의 노트 = 하나의 주제. 여러 주제를 섞지 마세요.
2. **연결** -- 모든 노트는 [[wikilink]]로 관련 노트에 연결. 고립된 노트는 발견되지 않습니다.
3. **자기 언어** -- 복사-붙여넣기가 아닌, 핵심을 이해하고 간결하게 서술하세요.

### MCP Tools
- **지식 관리**: \`context-mcp_search_knowledge\`, \`context-mcp_read_knowledge\`, \`context-mcp_create_knowledge_note\`, \`context-mcp_update_knowledge_note\`
- **데일리 노트**: \`context-mcp_read_daily_note\`, \`context-mcp_append_daily_note\`
- **작업 완료**: \`context-mcp_submit_turn_complete\` (작업 종료 시 필수 호출)

### 작업 전 필수
- **데일리 노트 확인**: 가장 최근의 데일리 노트를 읽고 이전 세션의 컨텍스트와 미해결 이슈를 파악하세요.
- **작업 의도 선언**: 작업 시작 전, 현재 세션의 목표와 작업 의도를 명확히 파악하고 선언하세요.
- **지식 검색**: 작업과 관련된 문서를 **직접 먼저** 검색하고 읽으세요.
- 지식 파일에 기록된 아키텍처 결정, 패턴, 제약사항을 반드시 따르세요.

### 개발 원칙
- **TDD** (Test-Driven Development): 테스트를 먼저 작성하고(RED), 구현하여 통과시킨 뒤(GREEN), 리팩토링하세요.
- **DDD** (Domain-Driven Design): 도메인 개념을 코드 구조에 반영하세요.
- **테스트 커버리지**: 새로 작성하거나 변경한 코드는 테스트 커버리지 80% 이상을 목표로 하세요.

### 우선순위
- AGENTS.md의 지시사항이 항상 최우선
- 지식 노트의 결정사항 > 일반적 관행
- 지식 노트에 없는 새로운 결정이나 반복 가치가 있는 발견은 작업 메모나 지식 노트 후보로 기록하세요.`;

async function onSessionStart(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  const projectDir = resolveProjectDir(event);

  scaffoldIfNeeded(projectDir);

  injectIntoAgentsMd(join(projectDir, 'AGENTS.md'), STATIC_KNOWLEDGE_CONTEXT);
  await sdk.log.info(`Injected context into AGENTS.md for ${projectDir}`);
}

async function onTurnComplete(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  const projectDir = resolveProjectDir(event);
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

  if (typeof sdk.tmux?.sendKeys !== 'function') {
    await logWarn(sdk, 'turn_end_sendkeys_failed', {
      event: event.event,
      session_id: event.session_id,
      turn_id: event.turn_id,
      reason: 'tmux_sendkeys_unavailable',
    });
    return;
  }

  const turnEnd =
    "TURN END. You MUST call the 'submit_turn_complete' MCP tool to finalize your work and record notes. Do not wait for user input.";
  const reminderText = `<system-reminder>\n${turnEnd}\n</system-reminder>`;
  const sessionName =
    typeof event.context?.session_name === 'string' && event.context.session_name.trim().length > 0
      ? event.context.session_name.trim()
      : undefined;

  // Add a small delay to ensure terminal buffer is flushed before injecting
  await new Promise((resolve) => globalThis.setTimeout(resolve, 500));

  if (typeof sdk.tmux?.sendKeys === 'function') {
    // We don't need to clear buffer, we just need to make sure we are not pasting.
    // sendKeys uses `tmux send-keys -l "text"`, which shouldn't paste clipboard.
    // Wait, the issue is that `turnEndRaw` might contain the combined content if `turnEndPath` is somehow pointing to `AGENTS.md`?
    // No, `turnEndPath` is `.context/prompts/turn-end.md`.
  }

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
