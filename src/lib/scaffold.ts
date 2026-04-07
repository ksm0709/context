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
  // Set "enabled": true to activate a check. All checks are disabled by default.
  // triggerCommand: exit 0 = run the check, non-zero = auto-skip with signal.
  // agent checks: PASS/FAIL instruction is auto-injected — omit from prompt.
  "smokeChecks": [

    // === TESTING ===
    {
      "name": "tests",
      "enabled": false,
      // skip if no test script defined in package.json
      "triggerCommand": "node -e \\"require('./package.json').scripts?.test || process.exit(1)\\"",
      "command": "npm test",
      // "command": "go test ./...",       // Go
      // "command": "pytest",              // Python
      // "command": "cargo test",          // Rust
      "signal": ".context/.check-tests-passed"
    },

    // === CODE QUALITY ===
    {
      "name": "lint",
      "enabled": false,
      // skip if no ESLint config found
      "triggerCommand": "ls .eslintrc* eslint.config* 2>/dev/null | head -1 | grep -q .",
      "command": "npm run lint",
      // "command": "golangci-lint run",   // Go
      // "command": "ruff check .",        // Python
      "signal": ".context/.check-lint-passed"
    },
    {
      "name": "typecheck",
      "enabled": false,
      // skip if no tsconfig.json
      "triggerCommand": "test -f tsconfig.json",
      "command": "npx tsc --noEmit",
      "signal": ".context/.check-typecheck-passed"
    },
    {
      "name": "format",
      "enabled": false,
      // skip if no Prettier config found
      "triggerCommand": "ls .prettierrc* prettier.config* 2>/dev/null | head -1 | grep -q .",
      "command": "npx prettier --check .",
      // "command": "gofmt -l . | grep . && exit 1 || exit 0",  // Go
      "signal": ".context/.check-format-passed"
    },
    {
      "name": "build",
      "enabled": false,
      // skip if no build script defined in package.json
      "triggerCommand": "node -e \\"require('./package.json').scripts?.build || process.exit(1)\\"",
      "command": "npm run build",
      "signal": ".context/.check-build-passed"
    },

    // === SECURITY ===
    {
      "name": "security-audit",
      "enabled": false,
      // skip if no package-lock.json (non-npm projects)
      "triggerCommand": "test -f package-lock.json",
      "command": "npm audit --audit-level=high",
      "signal": ".context/.check-security-audit-passed"
    },
    {
      "name": "secrets-scan",
      "enabled": false,
      // skip if no commits yet
      "triggerCommand": "git log -1 --oneline",
      "command": "git diff HEAD~1 --name-only | xargs grep -l -E '(password|secret|api_key|token)\\\\s*=' 2>/dev/null && exit 1 || exit 0",
      "signal": ".context/.check-secrets-scan-passed"
    },

    // === GIT ===
    {
      "name": "git-clean",
      "enabled": false,
      // skip if not inside a git repo
      "triggerCommand": "git rev-parse --is-inside-work-tree",
      "command": "git diff --exit-code && git diff --cached --exit-code",
      "signal": ".context/.check-git-clean-passed"
    },

    // === AI AGENT CHECKS (type: agent) ===
    // PASS/FAIL output instruction is auto-injected by run_smoke_check.
    // "cli" selects the agent binary (default: "claude"). e.g. "codex", "gemini".
    {
      "name": "code-review",
      "enabled": false,
      "type": "agent",
      // "cli": "claude",  // default; change to "codex", "gemini", etc.
      // skip if no commits to diff
      "triggerCommand": "git log -1 --oneline",
      "prompt": "Review the recent git diff (run: git diff HEAD~1)\\nfor code quality issues, potential bugs, unclear naming,\\nmissing error handling, and SOLID principle violations.\\nBe specific about any issues found.",
      "signal": ".context/.check-code-review-passed",
      "timeout": 120000
    },
    {
      "name": "scope-review",
      "enabled": false,
      "type": "agent",
      // skip if no commits to diff
      "triggerCommand": "git log -1 --oneline",
      "prompt": "Review the recent git diff (run: git diff HEAD~1)\\nand compare it against the task description in AGENTS.md\\nor CLAUDE.md. Check if changes stay within the intended\\nscope without unrelated modifications.",
      "signal": ".context/.check-scope-review-passed",
      "timeout": 120000
    },
    {
      "name": "memory-update",
      "enabled": false,
      "type": "agent",
      // skip if no commits to diff
      "triggerCommand": "git log -1 --oneline",
      "prompt": "Review recent changes (run: git diff HEAD~1) and check\\nif any important architectural decisions, patterns, or\\ncontext should be documented in AGENTS.md or CLAUDE.md.\\nIf the docs are up to date, that is fine. Otherwise\\ndescribe what is missing.",
      "signal": ".context/.check-memory-update-passed",
      "timeout": 120000
    },
    {
      "name": "test-coverage",
      "enabled": false,
      "type": "agent",
      // skip if no commits to diff
      "triggerCommand": "git log -1 --oneline",
      "prompt": "Review the recent git diff (run: git diff HEAD~1).\\nFor each new function or method added, check if there\\nis a corresponding test. Verify that edge cases are\\ncovered. Report any significant gaps in coverage.",
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
