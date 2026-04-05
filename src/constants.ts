export const BUILTIN_SIGNALS = {
  hash: '.context/.check-hash-passed',
  scope: '.context/.check-scope-passed',
} as const;

export const DEFAULTS = {
  configPath: '.context/config.jsonc',
  signalDir: '.context',
  workCompleteFile: '.context/.work-complete',
} as const;

export const LIMITS = {
  maxPromptFileSize: 64 * 1024, // 64KB
  maxTotalInjectionSize: 128 * 1024, // 128KB
  smokeCheckTimeout: 30_000, // 30 second default timeout for smoke checks
} as const;
