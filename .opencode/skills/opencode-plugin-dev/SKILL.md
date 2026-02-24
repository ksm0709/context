---
name: opencode-plugin-dev
description: >
  OpenCode plugin development skill for this project (@ksm0709/intent-tools).
  Provides API reference, architecture patterns, and implementation tips sourced
  from official docs and real-world plugins (DCP, oh-my-opencode, wakatime, helicone).

  Use when:
  - Implementing OpenCode plugin hooks (tool.execute.before/after, chat.params,
    chat.headers, shell.env, event, config, experimental.*)
  - Registering custom tools, slash commands, or permissions
  - Designing plugin architecture (flat / lib-modular / full-separation)
  - Structuring package.json and build config for npm publishing
  - Tracking tool execution results via the event hook
  - Managing per-session state inside a plugin
  - Adding a config system with global/project-level merge
  - Working on any feature of the intent-tools plugin
---

# OpenCode Plugin Dev — intent-tools

> **Reference files** (load as needed):
>
> - [references/api-reference.md](references/api-reference.md) — Full `@opencode-ai/plugin` type API
> - [references/patterns.md](references/patterns.md) — Architecture, state, config, build patterns

---

## Plugin Skeleton

```typescript
import type { Plugin } from '@opencode-ai/plugin';

export const MyPlugin: Plugin = async ({ client, project, directory, worktree, $ }) => {
  // runs once at startup
  return {
    /* hooks */
  };
};

export default MyPlugin;
// RULE: index.ts에서 export type 만 허용.
// 함수/상수 named export 금지 — OpenCode가 모든 export를 플러그인으로 호출함.
```

---

## Core Hooks Quick Reference

| Hook                                   | 용도                                  |
| -------------------------------------- | ------------------------------------- |
| `tool`                                 | 커스텀 툴 등록                        |
| `config`                               | 슬래시 커맨드·권한·primary_tools 등록 |
| `event`                                | 툴 실행 결과 추적, 세션 라이프사이클  |
| `tool.execute.before`                  | 툴 실행 전 args 수정 / 차단           |
| `tool.execute.after`                   | 툴 실행 후 output 수정                |
| `chat.params`                          | LLM 요청 파라미터 수정                |
| `chat.headers`                         | LLM 요청 헤더 수정                    |
| `shell.env`                            | 셸 환경변수 주입                      |
| `experimental.chat.system.transform`   | 시스템 프롬프트 수정                  |
| `experimental.chat.messages.transform` | 대화 히스토리 수정                    |
| `experimental.session.compacting`      | 세션 압축 프롬프트 커스텀             |

전체 타입 시그니처 → [references/api-reference.md](references/api-reference.md)

---

## Custom Tool

```typescript
import { tool } from "@opencode-ai/plugin"

tool: {
  mytool: tool({
    description: "...",
    args: { query: tool.schema.string().describe("검색어") },
    async execute(args, ctx) {
      // ctx: { sessionID, messageID, agent, directory, worktree, abort, metadata(), ask() }
      ctx.metadata({ title: "Processing...", metadata: { key: "val" } })
      return `result: ${args.query}`
    },
  }),
}
```

---

## config Hook

```typescript
config: async (cfg) => {
  // 슬래시 커맨드 등록
  cfg.command ??= {};
  cfg.command['mycmd'] = { template: '', description: '설명' };

  // AI가 우선 사용하는 툴 목록에 추가
  cfg.experimental = {
    ...cfg.experimental,
    primary_tools: [...(cfg.experimental?.primary_tools ?? []), 'mytool'],
  };

  // 툴 권한: "allow" | "ask" | "deny"
  cfg.permission = { ...cfg.permission, mytool: 'allow' };
};
```

---

## event Hook — 툴 결과 추적

```typescript
const processedIds = new Set<string>();

event: async ({ event }) => {
  if (event.type === 'message.part.updated') {
    const part = event.properties.part;
    if (part.type !== 'tool' || part.state.status !== 'completed') return;
    if (processedIds.has(part.callID)) return; // 중복 방지
    processedIds.add(part.callID);
    if (processedIds.size > 1000) {
      // 메모리 관리
      const arr = [...processedIds];
      arr.slice(0, 500).forEach((id) => processedIds.delete(id));
    }
    // part.state: { tool, input, output, title, metadata, time }
  }
  if (event.type === 'session.idle' || event.type === 'session.deleted') {
    await cleanup();
  }
};
```

---

## package.json (이 프로젝트 기준)

```json
{
  "name": "@ksm0709/intent-tools",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "peerDependencies": { "@opencode-ai/plugin": ">=1.0.0" },
  "devDependencies": { "@opencode-ai/plugin": "^1.2.10" },
  "dependencies": { "zod": "^4.0.0" },
  "keywords": ["opencode", "opencode-plugin"],
  "files": ["dist/", "README.md", "LICENSE"]
}
```

Build: `bun build src/index.ts --outdir dist --target bun` (기존 AGENTS.md 참고)

---

## Logging

```typescript
// console.log 금지 (ESLint no-console). client.app.log() 사용.
await client.app.log({
  body: { service: 'intent-tools', level: 'info', message: '...', extra: {} },
});
```
