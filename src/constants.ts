export const DEFAULTS = {
  configPath: '.context/config.jsonc',
  signalDir: '.context',
  workCompleteFile: '.context/.work-complete',
} as const;

export const BUILTIN_SIGNALS = {
  checkHash: '.context/.check-hash-passed',
  checkScope: '.context/.check-scope-passed',
} as const;

export const LIMITS = {
  maxPromptFileSize: 64 * 1024, // 64KB
  maxTotalInjectionSize: 128 * 1024, // 128KB
  smokeCheckTimeout: 30_000, // 30 second default timeout for smoke checks
  agentCheckTimeout: 300_000, // 5 minute timeout for LLM-based reviewer/inference calls
} as const;
