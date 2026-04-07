import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveContextDir } from './context-dir';
import pkg from '../../package.json';

const PLUGIN_VERSION: string = pkg.version;

const DEFAULT_CONFIG = `{
  // Context Plugin Configuration
  // See: https://github.com/ksm0709/context
  "codex": {
    // Continue the turn at Stop until submit_turn_complete has been called
    "turnEnd": {
      "strategy": "stop-hook"
    }
  },

  // Required for backward compatibility with older installed versions.
  // Each smokeCheck entry must have a matching checks entry by name.
  "checks": [
    { "name": "tests",          "signal": ".context/.check-tests-passed" },
    { "name": "lint",           "signal": ".context/.check-lint-passed" },
    { "name": "typecheck",      "signal": ".context/.check-typecheck-passed" },
    { "name": "format",         "signal": ".context/.check-format-passed" },
    { "name": "build",          "signal": ".context/.check-build-passed" },
    { "name": "security-audit", "signal": ".context/.check-security-audit-passed" },
    { "name": "secrets-scan",   "signal": ".context/.check-secrets-scan-passed" },
    { "name": "git-clean",      "signal": ".context/.check-git-clean-passed" },
    { "name": "code-review",    "signal": ".context/.check-code-review-passed" },
    { "name": "scope-review",   "signal": ".context/.check-scope-review-passed" },
    { "name": "memory-update",  "signal": ".context/.check-memory-update-passed" },
    { "name": "test-coverage",  "signal": ".context/.check-test-coverage-passed" }
  ],

  // Smoke checks run before submit_turn_complete is accepted.
  // Set "enabled": true to activate a check. All checks below are disabled by default.
  // Each check writes a signal file when it passes.
  "smokeChecks": [

    // === TESTING ===
    {
      "name": "tests",
      "enabled": false,
      "command": "npm test",
      // "command": "go test ./...",        // Go projects
      // "command": "pytest",               // Python projects
      // "command": "cargo test",           // Rust projects
      "signal": ".context/.check-tests-passed"
    },

    // === CODE QUALITY ===
    {
      "name": "lint",
      "enabled": false,
      "command": "npm run lint",
      // "command": "golangci-lint run",    // Go projects
      // "command": "ruff check .",         // Python projects
      "signal": ".context/.check-lint-passed"
    },
    {
      "name": "typecheck",
      "enabled": false,
      "command": "npx tsc --noEmit",
      "signal": ".context/.check-typecheck-passed"
    },
    {
      "name": "format",
      "enabled": false,
      "command": "npx prettier --check .",
      // "command": "gofmt -l . | grep . && exit 1 || exit 0",  // Go projects
      "signal": ".context/.check-format-passed"
    },
    {
      "name": "build",
      "enabled": false,
      "command": "npm run build",
      "signal": ".context/.check-build-passed"
    },

    // === SECURITY ===
    {
      "name": "security-audit",
      "enabled": false,
      "command": "npm audit --audit-level=high",
      "signal": ".context/.check-security-audit-passed"
    },
    {
      "name": "secrets-scan",
      "enabled": false,
      "command": "git diff HEAD~1 --name-only | xargs grep -l -E '(password|secret|api_key|token)\\\\s*=' 2>/dev/null && exit 1 || exit 0",
      "signal": ".context/.check-secrets-scan-passed"
    },

    // === GIT ===
    {
      "name": "git-clean",
      "enabled": false,
      "command": "git diff --exit-code && git diff --cached --exit-code",
      "signal": ".context/.check-git-clean-passed"
    },

    // === AI AGENT CHECKS (type: agent) ===
    {
      "name": "code-review",
      "enabled": false,
      "type": "agent",
      "prompt": "Review the recent git diff (run: git diff HEAD~1) for code quality issues, potential bugs, unclear naming, missing error handling, and SOLID principle violations. Be specific. Output PASS if the code looks good, FAIL if there are significant issues.",
      "signal": ".context/.check-code-review-passed",
      "timeout": 120000
    },
    {
      "name": "scope-review",
      "enabled": false,
      "type": "agent",
      "prompt": "Review the recent git diff (run: git diff HEAD~1) and compare it against the task description in AGENTS.md or CLAUDE.md. Check if the changes stay within the intended scope and don't include unrelated modifications. Output PASS if scope is maintained, FAIL if there is scope creep.",
      "signal": ".context/.check-scope-review-passed",
      "timeout": 120000
    },
    {
      "name": "memory-update",
      "enabled": false,
      "type": "agent",
      "prompt": "Review recent changes (git diff HEAD~1) and check if any important architectural decisions, patterns, or context has been added that should be documented in AGENTS.md or CLAUDE.md. If documentation is up to date, output PASS. If important context is missing from the docs, output FAIL and describe what should be added.",
      "signal": ".context/.check-memory-update-passed",
      "timeout": 120000
    },
    {
      "name": "test-coverage",
      "enabled": false,
      "type": "agent",
      "prompt": "Review the recent git diff (run: git diff HEAD~1). For each new function or method added, check if there is a corresponding test. Check if edge cases are covered. Output PASS if test coverage is adequate, FAIL if significant test coverage is missing.",
      "signal": ".context/.check-test-coverage-passed",
      "timeout": 120000
    }
  ]
}`;

export function scaffoldIfNeeded(projectDir: string): boolean {
  const contextDir = join(projectDir, resolveContextDir(projectDir));

  // Idempotency check: if context dir exists, skip scaffolding
  if (existsSync(contextDir)) {
    return false;
  }

  try {
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, 'config.jsonc'), DEFAULT_CONFIG, 'utf-8');
    writeVersion(contextDir, PLUGIN_VERSION);
    return true;
  } catch {
    return false;
  }
}

export function updateScaffold(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
  mkdirSync(contextDir, { recursive: true });

  const updated: string[] = [];
  const configPath = join(contextDir, 'config.jsonc');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DEFAULT_CONFIG, 'utf-8');
    updated.push('config.jsonc');
  }

  writeVersion(contextDir, PLUGIN_VERSION);
  return updated;
}

/**
 * Read stored plugin version from the resolved context directory.
 * Returns null if file is missing or unreadable.
 */
export function getStoredVersion(projectDir: string): string | null {
  try {
    return readFileSync(
      join(projectDir, resolveContextDir(projectDir), '.version'),
      'utf-8'
    ).trim();
  } catch {
    return null;
  }
}

/**
 * Write plugin version to the resolved context directory.
 */
export function writeVersion(contextDir: string, version: string): void {
  writeFileSync(join(contextDir, '.version'), version, 'utf-8');
}

/**
 * Auto-update config when plugin version changes.
 * Skips config.jsonc to preserve user customizations.
 * Returns list of updated paths, or empty array if nothing changed.
 */
export function autoUpdateTemplates(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
  if (!existsSync(contextDir)) return [];

  const stored = getStoredVersion(projectDir);
  if (stored === PLUGIN_VERSION) return [];

  writeVersion(contextDir, PLUGIN_VERSION);
  return [];
}
