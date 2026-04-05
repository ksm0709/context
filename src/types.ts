export interface CheckEntry {
  name: string;
  signal: string; // path to signal file, must be under .context/
}

export interface SmokeCheckEntry {
  name: string;
  command: string;
  signal: string; // path to signal file, must be under .context/
}

export interface ContextConfig {
  checks?: CheckEntry[];
  smokeChecks?: SmokeCheckEntry[];
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
