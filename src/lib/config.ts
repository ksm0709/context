import { parse as parseJsonc } from 'jsonc-parser';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContextConfig } from '../types';
import { resolveContextDir } from './context-dir';

function validateConfig(config: ContextConfig): void {
  const checks = config.checks ?? [];
  const smokeChecks = config.smokeChecks ?? [];

  for (const check of checks) {
    if (!check.signal.startsWith('.context/')) {
      throw new Error(
        `Config error: checks[${JSON.stringify(check.name)}].signal must start with ".context/" (got: ${JSON.stringify(check.signal)})`
      );
    }
  }
  for (const sc of smokeChecks) {
    if (!sc.signal.startsWith('.context/')) {
      throw new Error(
        `Config error: smokeChecks[${JSON.stringify(sc.name)}].signal must start with ".context/" (got: ${JSON.stringify(sc.signal)})`
      );
    }
  }

  const checkNames = new Set(checks.map((c) => c.name));
  for (const sc of smokeChecks) {
    if (!checkNames.has(sc.name)) {
      throw new Error(
        `Config error: smokeChecks entry "${sc.name}" has no matching checks entry. Add { "name": "${sc.name}", "signal": "..." } to the checks array.`
      );
    }
  }
}

function getDefaultConfig(): ContextConfig {
  return {
    checks: [],
    smokeChecks: [],
    omx: {
      turnEnd: {
        strategy: 'turn-complete-sendkeys',
      },
    },
    omc: {
      turnEnd: {
        strategy: 'stop-hook',
      },
    },
  };
}

function mergeWithDefaults(partial: Partial<ContextConfig>): ContextConfig {
  const defaults = getDefaultConfig();
  return {
    checks: partial.checks ?? defaults.checks,
    smokeChecks: partial.smokeChecks ?? defaults.smokeChecks,
    omx: {
      turnEnd: {
        strategy: partial.omx?.turnEnd?.strategy ?? defaults.omx?.turnEnd?.strategy,
      },
    },
    omc: {
      turnEnd: {
        strategy: partial.omc?.turnEnd?.strategy ?? defaults.omc?.turnEnd?.strategy ?? 'stop-hook',
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
    const config = mergeWithDefaults(parsed);
    validateConfig(config);
    return config;
  } catch (err) {
    // Re-throw validation errors (they are user-facing config errors)
    if (err instanceof Error && err.message.startsWith('Config error:')) {
      throw err;
    }
    return getDefaultConfig();
  }
}
