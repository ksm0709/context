import { parse as parseJsonc } from 'jsonc-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContextConfig } from '../types';
import { DEFAULTS } from '../constants';

function getDefaultConfig(): ContextConfig {
  return {
    prompts: {
      turnStart: join(DEFAULTS.promptDir, DEFAULTS.turnStartFile),
      turnEnd: join(DEFAULTS.promptDir, DEFAULTS.turnEndFile),
      subagentTurnEnd: join(DEFAULTS.promptDir, DEFAULTS.subagentTurnEndFile),
    },
    subagentConfig: {
      blockedToolPatterns: [...DEFAULTS.blockedToolPatterns],
    },
    knowledge: {
      dir: DEFAULTS.knowledgeDir,
      sources: [...DEFAULTS.knowledgeSources],
      mode: 'auto',
      indexFilename: DEFAULTS.indexFilename,
      maxDomainDepth: DEFAULTS.maxDomainDepth,
    },
  };
}

function mergeWithDefaults(partial: Partial<ContextConfig>): ContextConfig {
  const defaults = getDefaultConfig();
  return {
    prompts: {
      turnStart: partial.prompts?.turnStart ?? defaults.prompts.turnStart,
      turnEnd: partial.prompts?.turnEnd ?? defaults.prompts.turnEnd,
      subagentTurnEnd: partial.prompts?.subagentTurnEnd ?? defaults.prompts.subagentTurnEnd,
    },
    subagentConfig: {
      blockedToolPatterns:
        partial.subagentConfig?.blockedToolPatterns ?? defaults.subagentConfig.blockedToolPatterns,
    },
    knowledge: {
      dir: partial.knowledge?.dir ?? defaults.knowledge.dir,
      sources: partial.knowledge?.sources ?? defaults.knowledge.sources,
      mode: partial.knowledge?.mode ?? defaults.knowledge.mode,
      indexFilename: partial.knowledge?.indexFilename ?? defaults.knowledge.indexFilename,
      maxDomainDepth: partial.knowledge?.maxDomainDepth ?? defaults.knowledge.maxDomainDepth,
    },
  };
}

export function loadConfig(projectDir: string): ContextConfig {
  const configPath = join(projectDir, DEFAULTS.configPath);
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = parseJsonc(raw) as Partial<ContextConfig> | undefined;
    if (!parsed || typeof parsed !== 'object') return getDefaultConfig();
    return mergeWithDefaults(parsed);
  } catch {
    return getDefaultConfig();
  }
}
