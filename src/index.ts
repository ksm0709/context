import { join } from 'node:path';
import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './lib/config.js';
import { buildKnowledgeIndex, formatKnowledgeIndex } from './lib/knowledge-index.js';
import { readPromptFile } from './lib/prompt-reader.js';
import { scaffoldIfNeeded, updateScaffold } from './lib/scaffold.js';
import { DEFAULTS } from './constants.js';

const plugin: Plugin = async ({ directory, client }) => {
  // 1. Scaffold on first run
  const scaffolded = scaffoldIfNeeded(directory);
  if (scaffolded) {
    await client.app.log({
      body: {
        service: 'context',
        level: 'info',
        message: 'Scaffold created at .opencode/context/',
      },
    });
  }

  // 2. Load config once at plugin init
  const config = loadConfig(directory);

  return {
    config: async (cfg) => {
      cfg.command ??= {};
      cfg.command['context-update'] = {
        template: '',
        description: 'Update context scaffold files to latest plugin version',
      };
    },

    'command.execute.before': async (input, output) => {
      if (input.command !== 'context-update') return;

      const updated = updateScaffold(directory);
      if (updated.length === 0) {
        output.parts = [{ type: 'text', text: 'All scaffold files are already up to date.' }];
      } else {
        const lines = updated.map((f) => `- ${f}`).join('\n');
        output.parts = [{ type: 'text', text: `Updated ${updated.length} file(s):\n${lines}` }];
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      // 3. Read prompt files fresh every call (hot-reload)
      const turnStartPath = join(
        directory,
        config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile)
      );

      const turnStart = readPromptFile(turnStartPath);

      // 4. Build knowledge index
      const knowledgeSources = [config.knowledge.dir, ...config.knowledge.sources].filter(
        (s): s is string => Boolean(s)
      );
      const entries = buildKnowledgeIndex(directory, knowledgeSources);
      const indexContent = formatKnowledgeIndex(entries);

      // 5. Inject into system prompt (only non-empty)
      if (turnStart) output.system.push(turnStart);
      if (indexContent) output.system.push(indexContent);
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      // 6. Inject turn-end as synthetic user message (hot-reload)
      const turnEndPath = join(
        directory,
        config.prompts.turnEnd ?? join(DEFAULTS.promptDir, DEFAULTS.turnEndFile)
      );
      const turnEnd = readPromptFile(turnEndPath);
      if (!turnEnd) return;
      if (output.messages.length === 0) return;

      const lastUserMsg = output.messages.filter((m) => m.info.role === 'user').at(-1);
      if (!lastUserMsg) return;

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
            synthetic: true,
          },
        ],
      });
    },
  };
};

export default plugin;
