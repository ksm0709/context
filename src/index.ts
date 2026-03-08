import { join } from 'node:path';
import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './lib/config.js';
import {
  buildKnowledgeIndexV2,
  formatKnowledgeIndex,
  formatDomainIndex,
} from './lib/knowledge-index.js';
import { readPromptFile } from './lib/prompt-reader.js';
import { scaffoldIfNeeded, autoUpdateTemplates } from './lib/scaffold.js';
import { DEFAULTS } from './constants.js';

const plugin: Plugin = async ({ directory, client }) => {
  // 1. Scaffold on first run, or auto-update templates on version change
  const scaffolded = scaffoldIfNeeded(directory);
  if (scaffolded) {
    await client.app.log({
      body: {
        service: 'context',
        level: 'info',
        message: 'Scaffold created at .opencode/context/',
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
    'tool.execute.before': async (input) => {
      try {
        const session = await client.session.get({ path: { id: input.sessionID } });
        if (!session) return;

        const isSubagent = ['explore', 'librarian', 'oracle', 'Sisyphus-Junior'].includes(
          session.agent
        );

        if (isSubagent) {
          const patterns =
            config.subagentConfig?.blockedToolPatterns ?? DEFAULTS.blockedToolPatterns;
          const isBlocked = patterns.some((pattern) => new RegExp(pattern, 'i').test(input.tool));

          if (isBlocked) {
            throw new Error(
              `[Security] Subagents are not allowed to use orchestration tools (${input.tool}). Please return control to the main agent.`
            );
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('[Security]')) {
          throw err;
        }
        // Ignore other errors (e.g. session fetch failure) to not break execution
      }
    },
    'experimental.chat.messages.transform': async (_input, output) => {
      if (output.messages.length === 0) return;

      const lastUserMsg = output.messages.filter((m) => m.info.role === 'user').at(-1);
      if (!lastUserMsg) return;

      // 3. turn-start + knowledge index: combine and append to last user message (hot-reload)
      const turnStartPath = join(
        directory,
        config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile)
      );
      const turnStart = readPromptFile(turnStartPath);

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
      const agentName = (lastUserMsg.info as any).agent || 'default';
      const isSubagent = ['explore', 'librarian', 'oracle', 'Sisyphus-Junior'].includes(agentName);

      const turnEndPath = join(
        directory,
        isSubagent
          ? (config.prompts.subagentTurnEnd ??
              join(DEFAULTS.promptDir, DEFAULTS.subagentTurnEndFile))
          : (config.prompts.turnEnd ?? join(DEFAULTS.promptDir, DEFAULTS.turnEndFile))
      );
      const turnEnd = readPromptFile(turnEndPath);
      if (!turnEnd) return;

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
