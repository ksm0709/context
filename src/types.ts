export interface CheckEntry {
  name: string;
  signal: string; // path to signal file, must be under .context/
}

export interface SmokeCheckEntry {
  name: string;
  command?: string;
  type?: 'command' | 'agent'; // default: 'command'
  prompt?: string; // required when type is 'agent'; PASS/FAIL suffix appended automatically
  signal: string; // path to signal file, must be under .context/
  timeout?: number; // ms, overrides LIMITS.smokeCheckTimeout if set (1000–600000)
  triggerCommand?: string; // shell command; exit 0 = run check, non-zero = auto-skip
}

export interface ContextConfig {
  checks?: CheckEntry[];
  smokeChecks?: SmokeCheckEntry[];
  codex?: {
    turnEnd?: {
      strategy?: CodexTurnEndStrategy;
    };
  };
  claude?: {
    turnEnd?: {
      strategy: 'off' | 'stop-hook';
    };
  };
  omx?: {
    turnEnd?: {
      strategy?: OmxTurnEndStrategy;
    };
  };
  omc?: {
    turnEnd?: {
      strategy: 'off' | 'stop-hook';
    };
  };
}

export type OmxTurnEndStrategy = 'off' | 'turn-complete-sendkeys';
export type CodexTurnEndStrategy = 'off' | 'stop-hook';
