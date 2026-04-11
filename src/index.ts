import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from '@opencode-ai/plugin';
import { resolveContextDir } from './lib/context-dir.js';
import { loadConfig } from './lib/config.js';
import { resolveProjectPaths } from './lib/project-root.js';
import { scaffoldIfNeeded, autoUpdateTemplates } from './lib/scaffold.js';
import { BUILTIN_SIGNALS, DEFAULTS } from './constants.js';

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.csv']);

/** PatchPart 기반으로 이번 세션에서 소스 코드 파일이 변경됐는지 확인 */
function hasSourceCodeChanges(
  messages: Array<{ parts: Array<{ type?: string; files?: string[] }> }>
): boolean {
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'patch' && Array.isArray(part.files)) {
        for (const file of part.files) {
          if (!DOC_EXTENSIONS.has(extname(file).toLowerCase())) return true;
        }
      }
    }
  }
  return false;
}

/** checks 목록의 signal 파일을 자동 생성 (smoke check 없이 pass 처리) */
function writeSkipSignals(
  projectRoot: string,
  checks: Array<{ signal: string }>,
  sessionId: string
): void {
  const content = `session_id=${sessionId}\ntimestamp=${Date.now()}\nskipped=true\n`;
  for (const check of checks) {
    const signalPath = join(projectRoot, check.signal);
    mkdirSync(dirname(signalPath), { recursive: true });
    writeFileSync(signalPath, content, 'utf-8');
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const plugin: Plugin = async ({ directory, client }) => {
  // 1. Resolve to git repo root (or home dir if not in a git repo)
  const { contextParent: projectRoot } = resolveProjectPaths(directory);

  // 2. Scaffold on first run, or auto-update templates on version change
  const scaffolded = scaffoldIfNeeded(projectRoot);
  const contextDir = resolveContextDir(projectRoot);

  if (scaffolded) {
    await client.app.log({
      body: {
        service: 'context',
        level: 'info',
        message: `Scaffold created at ${contextDir}/`,
      },
    });
  } else {
    // Auto-update templates when plugin version changes
    const autoUpdated = autoUpdateTemplates(projectRoot);
    if (autoUpdated.length > 0) {
      await client.app.log({
        body: {
          service: 'context',
          level: 'info',
          message: `Auto-updated ${autoUpdated.length} template(s): ${autoUpdated.join(', ')}`,
        },
      });
    }
  }

  return {
    config: async (config) => {
      config.mcp = config.mcp || {};
      config.mcp['context-mcp'] = {
        type: 'local',
        command: ['bun', join(__dirname, 'mcp.js')],
      };
    },
    'experimental.chat.messages.transform': async (_input, output) => {
      if (output.messages.length === 0) return;

      const lastUserMsg = output.messages.filter((m) => m.info.role === 'user').at(-1);
      if (!lastUserMsg) return;

      // 만약 마지막 유저 메시지가 이미 turn-end 리마인더(tmux send-keys로 주입된 것)라면,
      // turn-start를 덧붙이거나 turn-end를 중복 주입하지 않습니다.
      // 주의: 서브에이전트의 [SYSTEM DIRECTIVE...] 도 <system-reminder>를 사용하므로, 'TURN END' 텍스트로 구분합니다.
      const isTurnEndMessage = lastUserMsg.parts.some(
        (p) =>
          p.type === 'text' && p.text.includes('<system-reminder>') && p.text.includes('TURN END')
      );
      if (isTurnEndMessage) {
        return;
      }

      // 6. Necessity gate: 소스 코드 변경 없으면 빌트인 + config checks 모두 skip signal 자동 생성
      if (!hasSourceCodeChanges(output.messages)) {
        try {
          const config = loadConfig(projectRoot);
          const smokeChecks = config.smokeChecks ?? [];
          const triggerCommandNames = new Set(
            smokeChecks.filter((sc) => sc.triggerCommand).map((sc) => sc.name)
          );
          const configChecks = (config.checks ?? []).filter(
            (c) => !triggerCommandNames.has(c.name)
          );
          const builtinChecks = Object.values(BUILTIN_SIGNALS).map((signal: string) => ({
            signal,
          }));
          writeSkipSignals(
            projectRoot,
            [...builtinChecks, ...configChecks],
            lastUserMsg.info.sessionID
          );
        } catch {
          // config 로드 실패 시 기존 동작 유지
        }
      }

      // 7. turn-end: inject as separate user message (hot-reload)
      const signalPath = join(projectRoot, DEFAULTS.workCompleteFile);
      if (existsSync(signalPath)) {
        const content = readFileSync(signalPath, 'utf-8');
        const match = content.match(/^session_id=(.*)$/m);
        const fileSessionId = match ? match[1].trim() : undefined;

        if (fileSessionId && fileSessionId !== lastUserMsg.info.sessionID) {
          // 다른 세션의 signal file — 무시
        } else {
          const { mtimeMs } = statSync(signalPath);
          const userCreatedAt = lastUserMsg.info?.time?.created ?? 0;

          if (mtimeMs >= userCreatedAt) {
            // signal file이 현재 user message 이후에 생성됨 = 아직 같은 user turn
            return;
          }

          // 다음 user message 도착으로 stale file이 됨
          unlinkSync(signalPath);
        }
      }

      const msgId = `context-turn-end-${Date.now()}`;
      output.messages.push({
        info: {
          id: msgId,
          sessionID: lastUserMsg.info.sessionID,
          role: 'user' as const,
          time: { created: Date.now() },
          agent: (lastUserMsg.info as { role: 'user'; agent: string }).agent,
          model: (
            lastUserMsg.info as { role: 'user'; model: { providerID: string; modelID: string } }
          ).model,
        },
        parts: [
          {
            id: `context-turn-end-part-${Date.now()}`,
            sessionID: lastUserMsg.info.sessionID,
            messageID: msgId,
            type: 'text' as const,
            text: `<system-reminder> TURN END. You MUST call the 'submit_turn_complete' MCP tool to verify quality gates and finalize your work. Do not wait for user input. </system-reminder>`,
          },
        ],
      });
    },
  };
};

export default plugin;
