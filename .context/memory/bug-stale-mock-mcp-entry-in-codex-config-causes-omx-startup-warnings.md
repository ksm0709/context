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


## Summary
A stale `[mcp_servers.mock-mcp]` block in `~/.codex/config.toml` can make Codex/OMX print MCP startup warnings even though `~/.omx/mcp-registry.json` is healthy.

## Symptoms
- `MCP client for \`mock-mcp\` failed to start`
- `connection closed: initialize response`
- `/mcp` shows `mock-mcp` enabled but with no tools/resources

## Root cause
The `mock-mcp` block can live outside the `Managed by omx setup` registry-sync section, so `omx setup` preserves it. If its `args[0]` points to a deleted file such as `/home/.../mock-mcp.js`, Codex launches `bun <missing-file>` and the process exits before MCP initialization completes.

## Fix
Add a narrow Codex config cleanup that removes `mock-mcp` only when its first arg is an absolute path to a missing file. Run that cleanup during `install omx` and again on OMX `session-start` so one bad session self-heals the next one.

## Verification
- Unit tests for stale/missing-vs-existing mock-mcp config handling
- Install flow test covering cleanup message
- OMX session-start test covering self-healing cleanup log

## Guardrails
Do not delete arbitrary MCP servers. Limit the cleanup to the `mock-mcp` server name and only when the referenced file is missing.
## Related Notes

- [[omx-setup]]
- [[architecture]]
