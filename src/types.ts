export interface CheckEntry {
  name: string;
  signal: string; // path to signal file, must be under .context/
}

export interface SmokeCheckEntry {
  name: string;
  enabled?: boolean; // default: true when undefined (backwards compat); false = skip
  command?: string;
  type?: 'command' | 'agent'; // default: 'command'
  prompt?: string; // required when type is 'agent'; PASS/FAIL suffix appended automatically
  cli?: string;   // CLI binary for agent checks (default: 'claude'). e.g. 'codex', 'gemini', '/path/to/agent'
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
  omc?: {
    turnEnd?: {
      strategy: 'off' | 'stop-hook';
    };
  };
}

export type CodexTurnEndStrategy = 'off' | 'stop-hook';
