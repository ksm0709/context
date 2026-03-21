import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './lib/config.js';
import { resolveContextDir } from './lib/context-dir.js';
import {
  buildKnowledgeIndexV2,
  formatKnowledgeIndex,
  formatDomainIndex,
} from './lib/knowledge-index.js';
import { readPromptFile, resolvePromptVariables } from './lib/prompt-reader.js';
import { scaffoldIfNeeded, autoUpdateTemplates } from './lib/scaffold.js';
import { DEFAULTS } from './constants.js';

/**
 * Resolve a prompt file path relative to the project directory.
 * - Absolute paths are used as-is
 * - Paths starting with '.context/' or '.opencode/' are project-root-relative
 * - Other relative paths are resolved relative to the resolved context dir
 */
function resolvePromptPath(directory: string, contextDir: string, promptPath: string): string {
  if (isAbsolute(promptPath)) return promptPath;
  if (promptPath.startsWith('.context/') || promptPath.startsWith('.opencode/')) {
    return join(directory, promptPath);
  }
  return join(directory, contextDir, promptPath);
}

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

  // 2. Load config once at plugin init
  const config = loadConfig(directory);

  return {
    'experimental.chat.messages.transform': async (_input, output) => {
      if (output.messages.length === 0) return;

      const lastUserMsg = output.messages.filter((m) => m.info.role === 'user').at(-1);
      if (!lastUserMsg) return;

      // Prepare prompt variables for template resolution
      const promptVars = {
        knowledgeDir: config.knowledge.dir ?? 'docs',
        sessionId: lastUserMsg.info.sessionID,
      };

      // 3. turn-start + knowledge index: combine and append to last user message (hot-reload)
      const turnStartPath = resolvePromptPath(
        directory,
        contextDir,
        config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile)
      );
      const turnStartRaw = readPromptFile(turnStartPath) ?? '';
      const turnStart = resolvePromptVariables(turnStartRaw, promptVars);

      const knowledgeIndex = buildKnowledgeIndexV2(directory, config.knowledge);
      const indexContent =
        knowledgeIndex.mode === 'flat'
          ? formatKnowledgeIndex(knowledgeIndex.individualFiles)
          : formatDomainIndex(knowledgeIndex);

      const combinedContent = [turnStart, indexContent].filter(Boolean).join('\n\n');
      if (combinedContent) {
        lastUserMsg.parts.push({
          id: `context-turn-start-${Date.now()}`,
          sessionID: lastUserMsg.info.sessionID,
          messageID: lastUserMsg.info.id,
          type: 'text' as const,
          text: combinedContent,
        });
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

      const turnEndPath = resolvePromptPath(
        directory,
        contextDir,
        config.prompts.turnEnd ?? join(DEFAULTS.promptDir, DEFAULTS.turnEndFile)
      );
      const turnEndRaw = readPromptFile(turnEndPath);
      if (!turnEndRaw) return;

      const turnEnd = resolvePromptVariables(turnEndRaw, promptVars);

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
            text: `<system-reminder>\n${turnEnd}\n</system-reminder>`,
          },
        ],
      });
    },
  };
};

export default plugin;
