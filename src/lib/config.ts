import { parse as parseJsonc } from 'jsonc-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContextConfig } from '../types';
import { DEFAULTS } from '../constants';
import { resolveContextDir } from './context-dir';

function getDefaultConfig(): ContextConfig {
  return {
    prompts: {
      turnStart: join(DEFAULTS.promptDir, DEFAULTS.turnStartFile),
      turnEnd: join(DEFAULTS.promptDir, DEFAULTS.turnEndFile),
    },
    knowledge: {
      dir: 'docs',
      sources: [...DEFAULTS.knowledgeSources],
      mode: 'auto',
      indexFilename: DEFAULTS.indexFilename,
      maxDomainDepth: DEFAULTS.maxDomainDepth,
    },
    omx: {
      turnEnd: {
        strategy: 'turn-complete-sendkeys',
      },
    },
  };
}

function mergeWithDefaults(partial: Partial<ContextConfig>): ContextConfig {
  const defaults = getDefaultConfig();
  return {
    prompts: {
      turnStart: partial.prompts?.turnStart ?? defaults.prompts.turnStart,
      turnEnd: partial.prompts?.turnEnd ?? defaults.prompts.turnEnd,
    },
    knowledge: {
      dir: partial.knowledge?.dir ?? defaults.knowledge.dir,
      sources: partial.knowledge?.sources ?? defaults.knowledge.sources,
      mode: partial.knowledge?.mode ?? defaults.knowledge.mode,
      indexFilename: partial.knowledge?.indexFilename ?? defaults.knowledge.indexFilename,
      maxDomainDepth: partial.knowledge?.maxDomainDepth ?? defaults.knowledge.maxDomainDepth,
    },
    omx: {
      turnEnd: {
        strategy: partial.omx?.turnEnd?.strategy ?? defaults.omx?.turnEnd?.strategy,
      },
    },
  };
}

export function loadConfig(projectDir: string): ContextConfig {
  const configPath = join(projectDir, resolveContextDir(projectDir), 'config.jsonc');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = parseJsonc(raw) as Partial<ContextConfig> | undefined;
    if (!parsed || typeof parsed !== 'object') return getDefaultConfig();
    return mergeWithDefaults(parsed);
  } catch {
    return getDefaultConfig();
  }
}
