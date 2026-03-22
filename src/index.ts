import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from '@opencode-ai/plugin';
import { resolveContextDir } from './lib/context-dir.js';
import { scaffoldIfNeeded, autoUpdateTemplates } from './lib/scaffold.js';
import { DEFAULTS } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const plugin: Plugin = async ({ directory, client }) => {
  // 1. Scaffold on first run, or auto-update templates on version change
  const scaffolded = scaffoldIfNeeded(directory);
  const contextDir = resolveContextDir(directory);

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
    const autoUpdated = autoUpdateTemplates(directory);
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
      // OMX 환경에서는 messages.transform을 통한 주입을 건너뜁니다.
      // (OMX는 onSessionStart에서 AGENTS.md에 주입하고, onTurnComplete에서 tmux send-keys로 turn-end를 주입합니다)
      if (process.env.OMX_HOOK_PLUGINS) return;

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

      // 6. turn-end: inject as separate user message (hot-reload)
      const signalPath = join(directory, DEFAULTS.workCompleteFile);
      if (existsSync(signalPath)) {
        const content = readFileSync(signalPath, 'utf-8');
        const match = content.match(/^session_id=(.*)$/m);
        const fileSessionId = match ? match[1].trim() : undefined;

        if (fileSessionId && fileSessionId !== lastUserMsg.info.sessionID) {
          // 다른 세션의 signal file — 무시
        } else {
          const { mtimeMs } = statSync(signalPath);
          const userCreatedAt = lastUserMsg.info.time.created;

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
            text: `<system-reminder> TURN END. You MUST call the 'submit_turn_complete' MCP tool to finalize your work and record notes. Do not wait for user input. </system-reminder>`,
          },
        ],
      });
    },
  };
};

export default plugin;
