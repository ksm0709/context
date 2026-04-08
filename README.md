# @ksm0709/context

Quality gate enforcement plugin for AI coding agents. Ensures every turn produces verified, committed, scope-checked work by requiring smoke checks and signal files before a turn can be marked complete.

Works with **Claude Code**, **Codex**, and **OpenCode** using their native integration surfaces.

## How It Works

```
Agent writes code
    │
    ▼
Turn ends → stop hook injects "call submit_turn_complete" reminder
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

**Custom smoke checks** — configurable shell commands or agent prompts (e.g., `npm test`, `npm run lint`)

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- [Claude Code](https://claude.ai/code), [Codex](https://github.com/openai/codex), or [OpenCode](https://opencode.ai)

### Install the package

```bash
npm install -g @ksm0709/context
```

### Recommended

```bash
context update
```

This will:
1. Scaffold `.context/` directory in your project
2. Register `context-mcp` as a native MCP server in `~/.config/opencode/opencode.json`
3. Register `context-mcp` MCP server via Claude CLI
4. Register Claude SessionStart and Stop hooks
5. Install native Codex hooks to `~/.codex/hooks/` and register `context-mcp`
6. Inject workflow context into global instructions where needed

### Individual installers

```bash
context update claude
context update codex
```

Use these only when you want to reinstall a single integration target.

## Configuration

Edit `.context/config.jsonc` in your project root:

```jsonc
{
  // Smoke checks define the commands that produce signal files
  "smokeChecks": [
    {
      "name": "tests",
      "command": "npm test",
      "signal": ".context/.check-tests-passed"
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "signal": ".context/.check-lint-passed",
      "enabled": false  // disabled by default — enable when ready
    }
  ]
}
```

The scaffold template includes 13 example smoke checks (all disabled by default). Enable the ones relevant to your project.

### Auto-inference

If you don't want to configure checks manually, the agent can call `infer_smoke_checks()` to analyze your project and auto-generate the config.

### Conditional Smoke Checks

Use `triggerCommand` to run a smoke check only when a condition is met:

```jsonc
{
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
| `name` | string | yes | Unique identifier for this check |
| `command` | string | when type=command | Shell command to execute |
| `type` | `"command"` \| `"agent"` | no | Default: `"command"` |
| `prompt` | string | when type=agent | Prompt for LLM-based review |
| `signal` | string | yes | Path to signal file (must start with `.context/`) |
| `timeout` | number | no | Timeout in ms (1000-600000, default: 30000) |
| `triggerCommand` | string | no | Condition command; exit 0 = run, non-zero = skip |
| `enabled` | boolean | no | Set `false` to skip this check entirely (default: `true`) |

## MCP Tools

The plugin exposes these tools via the `context-mcp` MCP server:

| Tool | Description |
|------|-------------|
| `run_smoke_check` | Run a named smoke check from config |
| `infer_smoke_checks` | Auto-detect and configure checks for the project |
| `submit_turn_complete` | Validate all signals and mark turn complete |

### Typical Agent Flow

```
1. Agent does work (writes code, makes changes)
2. Agent commits changes
3. Agent calls run_smoke_check({ name: "tests" })    → signal file created
4. Agent calls run_smoke_check({ name: "lint" })      → signal file created
5. Agent calls submit_turn_complete()                 → validates all signals, writes .work-complete
```

## Slash Commands

Two slash commands are available for manual quality gate control:

| Command | Description |
|---------|-------------|
| `/project:cleanup` | Reset quality gate — delete `.work-complete` and all signal files |
| `/project:manual-gating` | Manually run all smoke checks and call `submit_turn_complete` |

Use `/project:cleanup` when you want to force re-running quality checks in the current session. Use `/project:manual-gating` to trigger the full quality gate workflow without waiting for the stop hook.

## Native Hooks vs Quality Gate

These two mechanisms are complementary — **hooks enforce the protocol**, the **quality gate verifies the work**.

### Claude Native Hooks

Claude Code hooks (`SessionStart`, `Stop`) are OS-level processes that run at lifecycle events, independent of MCP tools:

| Aspect | Detail |
|--------|--------|
| **Trigger** | Lifecycle events (session start/end, tool use) |
| **Mechanism** | Shell process; reads JSON from stdin, writes JSON to stdout |
| **Power** | Can `block` the agent from stopping until conditions are met |
| **Context injection** | Can inject `additionalContext` into the agent's next turn |
| **Scope** | Always runs — agent cannot opt out |
| **Configuration** | `.claude/settings.json` (or global `~/.claude/settings.json`) |

The **Stop hook** is the enforcement layer. When the agent tries to stop, the hook checks whether `.work-complete` exists and is fresh. If not, it returns `decision: block` — forcing the agent back to call `submit_turn_complete` before it can exit.

The **SessionStart hook** cleans up stale `.work-complete` from the previous session and injects workflow context into `AGENTS.md` / `CLAUDE.md`.

### Quality Gate (Smoke Checks)

The quality gate is an MCP-based protocol the agent participates in voluntarily (or under hook pressure):

| Aspect | Detail |
|--------|--------|
| **Trigger** | Agent calls MCP tools explicitly |
| **Mechanism** | MCP server validates signal files with TTL + session binding |
| **Power** | Validates actual work quality (tests, lint, custom checks) |
| **Context injection** | None — only produces signal files and a `.work-complete` marker |
| **Scope** | Configurable per-project; individual checks can be disabled |
| **Configuration** | `.context/config.jsonc` |

### How They Work Together

```
Stop hook (enforcement)           Quality gate (verification)
─────────────────────             ───────────────────────────
Agent tries to stop               Agent calls run_smoke_check()
       │                                    │
       ▼                                    ▼
Hook checks .work-complete        Runs npm test / lint / agent prompt
       │                                    │
  missing → block                    pass → writes signal file
       │                                    │
  present → allow                          ▼
                                  Agent calls submit_turn_complete()
                                           │
                                    validates signals (TTL + session)
                                           │
                                    writes .work-complete
```

**Key differences:**

| | Native Hook | Quality Gate |
|---|---|---|
| Who runs it | OS / Claude runtime | Agent (via MCP call) |
| Can block agent | Yes (`decision: block`) | No (only produces files) |
| Validates work quality | No | Yes (tests, lint, review) |
| Multi-agent support | Claude-specific | Claude + Codex + OpenCode |
| Per-project config | Limited | Full (enable/disable/conditions) |
| Runs without agent cooperation | Yes | No (agent must call tools) |

**In practice**: the Stop hook is the "locked door" — the agent cannot exit without calling `submit_turn_complete`. The quality gate is the "checklist" behind the door — it defines what "done" actually means for this project.

## Necessity Gate

When no source code files are changed in a session (only docs like `.md`, `.txt`, `.rst`), the plugin automatically generates skip signals for all checks, so the agent doesn't need to run smoke checks for documentation-only changes.

Checks with `triggerCommand` are excluded from this auto-skip — their `triggerCommand` decides independently.

## CLI Commands

```bash
# Update scaffold and install Claude/Codex/OpenCode integrations
context update

# Update the plugin package itself
context update plugin

# Migrate from legacy .opencode/context/ to .context/
context update migrate

# Reinstall Claude integration only
context update claude

# Reinstall Codex integration only
context update codex

# Show version
context --version
```

## Project Structure

```
.context/
├── config.jsonc          # Plugin configuration (smokeChecks)
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
