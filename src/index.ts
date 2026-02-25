import { join } from 'node:path';
import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './lib/config.js';
import { buildKnowledgeIndex, formatKnowledgeIndex } from './lib/knowledge-index.js';
import { readPromptFile } from './lib/prompt-reader.js';
import { scaffoldIfNeeded } from './lib/scaffold.js';
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
    'experimental.chat.system.transform': async (_input, output) => {
      // 3. Read prompt files fresh every call (hot-reload)
      const turnStartPath = join(
        directory,
        config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile)
      );
      const turnEndPath = join(
        directory,
        config.prompts.turnEnd ?? join(DEFAULTS.promptDir, DEFAULTS.turnEndFile)
      );

      const turnStart = readPromptFile(turnStartPath);
      const turnEnd = readPromptFile(turnEndPath);

      // 4. Build knowledge index
      const entries = buildKnowledgeIndex(directory, config.knowledge.sources);
      const indexContent = formatKnowledgeIndex(entries);

      // 5. Inject into system prompt (only non-empty)
      if (turnStart) output.system.push(turnStart);
      if (indexContent) output.system.push(indexContent);
      if (turnEnd) output.system.push(turnEnd);
    },
  };
};

export default plugin;
