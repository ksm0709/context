import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';
import { existsSync, readdirSync, readFileSync as readFileSyncNode, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { CheckEntry, ContextConfig, SmokeCheckEntry } from '../types.js';
import { LIMITS } from '../constants.js';
import { resolveContextDir } from './context-dir.js';

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
    if (sc.timeout !== undefined && (sc.timeout < 1000 || sc.timeout > 600_000)) {
      throw new Error(
        `Config error: smokeChecks[${JSON.stringify(sc.name)}].timeout must be between 1000 and 600000ms (got: ${sc.timeout})`
      );
    }
    if (sc.triggerCommand !== undefined && typeof sc.triggerCommand !== 'string') {
      throw new Error(
        `Config error: smokeChecks[${JSON.stringify(sc.name)}].triggerCommand must be a string`
      );
    }
  }
}

function getDefaultConfig(): ContextConfig {
  return {
    checks: [],
    smokeChecks: [],
    turnEnd: {
      strategy: 'stop-hook',
    },
  };
}

function mergeWithDefaults(partial: Partial<ContextConfig>): ContextConfig {
  const defaults = getDefaultConfig();
  const strategy = partial.turnEnd?.strategy ?? defaults.turnEnd?.strategy ?? 'stop-hook';

  return {
    checks: partial.checks ?? defaults.checks,
    smokeChecks: partial.smokeChecks ?? defaults.smokeChecks,
    turnEnd: {
      strategy,
    },
  };
}

export function loadConfig(projectDir: string): ContextConfig {
  const configPath = join(projectDir, resolveContextDir(projectDir), 'config.jsonc');
  try {
    const raw = readFileSyncNode(configPath, 'utf-8');
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

function spawnWithStdin(
  cmd: string,
  args: string[],
  input: string,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { timeout });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Process exited with code ${code}`));
      else resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

function collectProjectInfo(projectDir: string): string {
  const parts: string[] = [];
  const candidates = ['package.json', 'go.mod', 'Makefile', 'pyproject.toml', 'Cargo.toml'];
  let totalSize = 0;
  const maxSize = 32 * 1024;

  for (const file of candidates) {
    const filePath = join(projectDir, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSyncNode(filePath, 'utf-8');
        if (totalSize + content.length <= maxSize) {
          parts.push(`=== ${file} ===\n${content}`);
          totalSize += content.length;
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  try {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    const fileList = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .join(', ');
    if (fileList) parts.push(`=== root files ===\n${fileList}`);
  } catch {
    // ignore
  }

  return parts.join('\n\n') || '(no project files found)';
}

function extractJson(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function buildInferencePrompt(projectInfo: string): string {
  return `Analyze the following project files and return ONLY a valid JSON object with "checks" and "smokeChecks" arrays for quality gate configuration.

Rules:
- All signal paths MUST start with ".context/" (e.g. ".context/.check-tests-passed")
- Each smokeChecks entry must have a matching checks entry with the same name
- Use common commands: npm test, npm run lint, npm run typecheck, go test ./..., pytest, cargo test, etc.
- Return ONLY the JSON, no explanation

Example output:
{
  "checks": [
    { "name": "tests", "signal": ".context/.check-tests-passed" }
  ],
  "smokeChecks": [
    { "name": "tests", "command": "npm test", "signal": ".context/.check-tests-passed" }
  ]
}

Project files:
${projectInfo}`;
}

export async function inferAndPersistChecks(projectDir: string): Promise<{
  checks: CheckEntry[];
  smokeChecks: SmokeCheckEntry[];
} | null> {
  const projectInfo = collectProjectInfo(projectDir);
  const prompt = buildInferencePrompt(projectInfo);

  let inferredJson: string | null = null;
  try {
    const stdout = await spawnWithStdin('claude', ['-p', '-'], prompt, LIMITS.agentCheckTimeout);
    inferredJson = extractJson(stdout);
  } catch {
    return null;
  }

  if (!inferredJson) return null;

  let inferred: { checks: CheckEntry[]; smokeChecks: SmokeCheckEntry[] };
  try {
    inferred = JSON.parse(inferredJson);
    if (!Array.isArray(inferred.checks) || !Array.isArray(inferred.smokeChecks)) return null;

    // Ensure all signals start with .context/
    for (const c of inferred.checks) {
      if (!c.signal.startsWith('.context/')) {
        c.signal = '.context/' + c.signal.replace(/^\.?\//, '');
      }
    }
    for (const sc of inferred.smokeChecks) {
      if (!sc.signal.startsWith('.context/')) {
        sc.signal = '.context/' + sc.signal.replace(/^\.?\//, '');
      }
    }
  } catch {
    return null;
  }

  try {
    const configPath = join(projectDir, resolveContextDir(projectDir), 'config.jsonc');
    const raw = existsSync(configPath) ? readFileSyncNode(configPath, 'utf-8') : '{}';
    let edits = modify(raw, ['checks'], inferred.checks, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    let updated = applyEdits(raw, edits);
    edits = modify(updated, ['smokeChecks'], inferred.smokeChecks, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    updated = applyEdits(updated, edits);
    writeFileSync(configPath, updated, 'utf-8');
  } catch {
    return null;
  }

  return inferred;
}
