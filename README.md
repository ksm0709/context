# @ksm0709/context

Quality gate enforcement plugin for AI coding agents. Ensures every turn produces verified, committed, scope-checked work by requiring smoke checks and signal files before a turn can be marked complete.

Works with **Claude Code** (via plugin system) and **Codex** (via OMX hooks).

## How It Works

```
Agent writes code
    │
    ▼
Turn ends → plugin injects "call submit_turn_complete" reminder
    │
    ▼
Agent runs smoke checks → signal files created (.context/.check-*-passed)
    │
    ▼
Agent calls submit_turn_complete → validates all signals are fresh
    │
    ▼
✓ Turn marked complete (.context/.work-complete)
```

**Built-in checks** (always required):
- `check_hash` — verifies all changes are committed
- `check_scope` — records scope review notes

**Custom smoke checks** — configurable shell commands or agent prompts (e.g., `npm test`, `npm run lint`)

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Claude Code](https://claude.ai/code) or [Codex](https://github.com/opencode-ai/opencode)

### Install the package

```bash
npm install -g @ksm0709/context
```

### For Claude Code

```bash
context install omc
```

This will:
1. Scaffold `.context/` directory in your project
2. Register `context-mcp` MCP server via Claude CLI
3. Register SessionStart and Stop hooks
4. Inject workflow context into `~/.claude/CLAUDE.md`

### For Codex (OMX)

```bash
context install omx
```

This will:
1. Scaffold `.context/` directory
2. Copy the OMX hook plugin to `.omx/hooks/context.mjs`
3. Register `context-mcp` in `~/.omx/mcp-registry.json`

## Configuration

Edit `.context/config.jsonc` in your project root:

```jsonc
{
  // Checks define which signal files submit_turn_complete validates
  "checks": [
    { "name": "tests", "signal": ".context/.check-tests-passed" },
    { "name": "lint", "signal": ".context/.check-lint-passed" }
  ],

  // Smoke checks define the commands that produce those signals
  "smokeChecks": [
    {
      "name": "tests",
      "command": "npm test",
      "signal": ".context/.check-tests-passed"
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "signal": ".context/.check-lint-passed"
    }
  ]
}
```

### Auto-inference

If you don't want to configure checks manually, the agent can call `infer_smoke_checks()` to analyze your project and auto-generate the config.

### Conditional Smoke Checks

Use `triggerCommand` to run a smoke check only when a condition is met:

```jsonc
{
  "checks": [
    { "name": "lint", "signal": ".context/.check-lint-passed" },
    { "name": "tests", "signal": ".context/.check-tests-passed" }
  ],
  "smokeChecks": [
    {
      "name": "lint",
      "command": "clang-tidy src/*.cpp",
      "signal": ".context/.check-lint-passed",
      // Only run when .cpp files were changed
      "triggerCommand": "git diff --name-only HEAD~1 | grep -qE '\\.cpp$'"
    },
    {
      "name": "tests",
      "command": "npm test",
      "signal": ".context/.check-tests-passed"
      // No triggerCommand → always runs
    }
  ]
}
```

**How `triggerCommand` works:**
- Exit 0 → condition met, smoke check runs normally
- Non-zero exit → condition not met, auto-skip signal written (`skipped=true`)
- Timeout (10s) → returns error (distinct from skip)
- Not set → check always runs (backward compatible)

Checks with `triggerCommand` bypass the global necessity gate (which auto-skips all checks when no source code changes are detected).

### Agent-type Smoke Checks

Use `type: "agent"` with a `prompt` to run an LLM-based review:

```jsonc
{
  "smokeChecks": [
    {
      "name": "code-review",
      "type": "agent",
      "prompt": "Review the recent changes for correctness and style issues.",
      "signal": ".context/.check-code-review-passed",
      "timeout": 300000
    }
  ]
}
```

### SmokeCheckEntry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique name matching a `checks` entry |
| `command` | string | when type=command | Shell command to execute |
| `type` | `"command"` \| `"agent"` | no | Default: `"command"` |
| `prompt` | string | when type=agent | Prompt for LLM-based review |
| `signal` | string | yes | Path to signal file (must start with `.context/`) |
| `timeout` | number | no | Timeout in ms (1000-600000, default: 30000) |
| `triggerCommand` | string | no | Condition command; exit 0 = run, non-zero = skip |

## MCP Tools

The plugin exposes these tools via the `context-mcp` MCP server:

| Tool | Description |
|------|-------------|
| `run_smoke_check` | Run a named smoke check from config |
| `check_hash` | Verify all changes are committed (git clean) |
| `check_scope` | Record scope review notes |
| `infer_smoke_checks` | Auto-detect and configure checks for the project |
| `submit_turn_complete` | Validate all signals and mark turn complete |

### Typical Agent Flow

```
1. Agent does work (writes code, makes changes)
2. Agent commits changes
3. Agent calls run_smoke_check({ name: "tests" })    → signal file created
4. Agent calls run_smoke_check({ name: "lint" })      → signal file created
5. Agent calls check_hash()                           → verifies clean git state
6. Agent calls check_scope({ notes: "..." })          → records scope notes
7. Agent calls submit_turn_complete()                 → validates all signals, writes .work-complete
```

## Necessity Gate

When no source code files are changed in a session (only docs like `.md`, `.txt`, `.rst`), the plugin automatically generates skip signals for all checks, so the agent doesn't need to run smoke checks for documentation-only changes.

Checks with `triggerCommand` are excluded from this auto-skip — their `triggerCommand` decides independently.

## CLI Commands

```bash
# Update scaffold templates and reinstall hooks
context update all

# Update prompt files only
context update prompt

# Update the plugin package itself
context update plugin

# Migrate from legacy .opencode/context/ to .context/
context migrate

# Install for Claude Code
context install omc

# Install for Codex
context install omx

# Show version
context --version
```

## Project Structure

```
.context/
├── config.jsonc          # Plugin configuration (checks, smokeChecks, strategies)
├── .version              # Plugin version tracker for auto-updates
├── .check-*-passed       # Signal files (auto-generated, gitignored)
└── .work-complete        # Turn completion marker (auto-generated)
```

## Signal File Format

Signal files are plain text with key-value pairs:

```
session_id=abc123
timestamp=1712456789000
caller=agent
```

Skip signals (from triggerCommand or necessity gate):

```
session_id=abc123
timestamp=1712456789000
skipped=true
```

- **TTL**: 1 hour — stale signals are rejected by `submit_turn_complete`
- **Session binding**: signals from a different session are rejected

## Development

```bash
# Install dependencies
bun install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## License

MIT
