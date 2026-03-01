export const DEFAULTS = {
  configPath: '.opencode/context/config.jsonc',
  promptDir: '.opencode/context/prompts',
  turnStartFile: 'turn-start.md',
  turnEndFile: 'turn-end.md',
  knowledgeSources: ['AGENTS.md'],
  knowledgeDir: 'docs',
  templateDir: '.opencode/context/templates',
  indexFilename: 'INDEX.md',
  maxDomainDepth: 2,
} as const;

export const LIMITS = {
  maxPromptFileSize: 64 * 1024, // 64KB
  maxIndexEntries: 100,
  maxTotalInjectionSize: 128 * 1024, // 128KB
  maxScanDepth: 3,
  maxSummaryLength: 100,
  maxIndexFileSize: 32 * 1024, // 32KB for INDEX.md files
} as const;
