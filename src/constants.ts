export const DEFAULTS = {
  configPath: '.context/config.jsonc',
  knowledgeSources: ['AGENTS.md'],
  templateDir: '.context/templates',
  indexFilename: 'INDEX.md',
  maxDomainDepth: 2,
  knowledgeDir: 'docs',
  guidesDir: '.context/guides',
  workCompleteFile: '.context/.work-complete',
} as const;

export const LIMITS = {
  maxPromptFileSize: 64 * 1024, // 64KB
  maxIndexEntries: 100,
  maxTotalInjectionSize: 128 * 1024, // 128KB
  maxScanDepth: 3,
  maxSummaryLength: 100,
  maxIndexFileSize: 32 * 1024, // 32KB for INDEX.md files
} as const;
