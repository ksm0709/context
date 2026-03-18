import { join } from 'node:path';

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
import { injectIntoAgentsMd } from './agents-md.js';

interface OmxHookContext {
  projectDir?: string;
  directory?: string;
}

interface OmxHookEvent {
  event: string;
  context?: OmxHookContext;
}

interface OmxSdk {
  log: {
    info: (message: string) => void | Promise<void>;
  };
}

function resolveProjectDir(event: OmxHookEvent): string {
  return event.context?.projectDir ?? event.context?.directory ?? process.cwd();
}

export async function onHookEvent(event: OmxHookEvent, sdk: OmxSdk): Promise<void> {
  if (event.event !== 'session-start') {
    return;
  }

  const projectDir = resolveProjectDir(event);
  const contextDir = resolveContextDir(projectDir);

  scaffoldIfNeeded(projectDir);

  const config = loadConfig(projectDir);
  const promptVars = { knowledgeDir: config.knowledge.dir ?? DEFAULTS.knowledgeDir };
  const turnStartPath = join(
    projectDir,
    contextDir,
    config.prompts.turnStart ?? join('prompts', DEFAULTS.turnStartFile)
  );
  const turnStart = resolvePromptVariables(readPromptFile(turnStartPath), promptVars);

  const knowledgeIndex = buildKnowledgeIndexV2(projectDir, config.knowledge);
  const indexContent =
    knowledgeIndex.mode === 'flat'
      ? formatKnowledgeIndex(knowledgeIndex.individualFiles)
      : formatDomainIndex(knowledgeIndex);
  const combinedContent = [turnStart, indexContent].filter(Boolean).join('\n\n');

  if (!combinedContent) {
    return;
  }

  injectIntoAgentsMd(join(projectDir, 'AGENTS.md'), combinedContent);
  await sdk.log.info(`Injected context into AGENTS.md for ${projectDir}`);
}
