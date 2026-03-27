# Bug: [간단한 설명]

## 증상

- 에러 메시지: `...`
- 관찰된 동작: ...

## 원인

실제 원인 분석

## 해결

// 수정 코드

## 예방

향후 같은 문제를 방지하는 방법

## 관련 노트

- [[유사-버그.md]] / [[예방-패턴.md]]


## Symptoms
- Running `context update omx` appears to reintroduce legacy `context_mcp` naming.
- Live config shows a mismatch: `~/.claude/settings.json` contains `mcpServers.context_mcp`, while `~/.omx/mcp-registry.json` contains `context-mcp`.

## Cause
1. `update` only supports `all`, `prompt`, and `plugin`. The token `omx` is not a supported update subcommand, so the CLI falls back to treating it as a project path.
2. Current install code shells out to `claude mcp add -s user context-mcp -- ...`, but the resulting Claude settings still use `context_mcp`. This strongly suggests the external Claude CLI normalizes the server name from hyphen to underscore when persisting settings.
3. The repo still injects `context_mcp_*` tool names into static AGENTS/guides content, which makes the legacy form look current even when OMX registry uses `context-mcp`.

## Resolution
- Treat `context update omx` as a CLI bug/footgun rather than a supported command.
- Align detection and normalization logic across `update`, `install`, AGENTS injection, and live settings handling.

## Prevention
- Add an explicit `update omx` branch or reject unknown subcommands instead of silently treating them as paths.
- Make OMC detection handle both `context-mcp` and `context_mcp`.
- Normalize one canonical MCP server name across generated guidance and installers.

## Related Notes

- [[adr-003-omx-compatibility]]

## Resolution (2026-03-26)
- Added an explicit `update omx` branch so the CLI no longer treats `omx` as a path fallback.
- Extended OMC detection to accept both `context-mcp` and `context_mcp` in Claude settings.
- Added post-install normalization in Claude settings so a legacy `context_mcp` entry is rewritten to the canonical `context-mcp` key.
- Updated CLI help/docs and added regression coverage.

## Verification
- Targeted tests: `src/cli/cli.test.ts`, `src/cli/commands/update.test.ts`, `src/cli/commands/install.test.ts`, `src/shared/claude-settings.test.ts`
- Full test suite: 202 passed
- Type diagnostics: 0 errors
- Raw build: passed
- Isolated tmux QA: passed using a fake `claude` binary that deliberately wrote `context_mcp`; the install flow normalized it and `update omx` did not invoke Claude again.
