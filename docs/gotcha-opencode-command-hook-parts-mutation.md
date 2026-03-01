# Gotcha: @opencode-ai/plugin -- command.execute.before에서 output.parts 재할당 무시됨

## 예상 vs 실제

**예상**: `command.execute.before` 훅에서 `output.parts = [{ type: 'text', text: '...' }]`로 재할당하면 AI에게 전달됨.

**실제**: 재할당하면 원본 배열 참조가 끊어져 AI가 빈 메시지를 받음. 커맨드 실행 후 에이전트가 아무 컨텍스트 없이 응답하거나, 커맨드가 동작하지 않는 것처럼 보임.

## 우회법

원본 배열을 뮤테이트해야 한다. `splice()`로 원본 배열 내용을 교체:

```typescript
// ❌ WRONG: 재할당 — 원본 참조 끊김
output.parts = [{ type: 'text', text: result }];

// ✅ CORRECT: 뮤테이션 — 원본 배열 수정
output.parts.splice(0, output.parts.length, { type: 'text', text: result });
```

## 원인 (알려진 경우)

OpenCode 소스(`packages/opencode/src/session/prompt.ts`)에서 커맨드 실행 흐름:

```typescript
const parts = await resolvePromptParts(command.template);
await Plugin.trigger("command.execute.before", { command, sessionID, arguments }, { parts });
const result = await prompt({ ..., parts }); // ← 원본 parts 변수 참조
```

`Plugin.trigger`가 `{ parts }` 객체를 output으로 전달하는데, 플러그인에서 `output.parts = [...]`로 재할당하면 `output` 객체의 `parts` 프로퍼티만 바뀌고 외부 `parts` 변수는 여전히 원래 빈 배열을 가리킨다. `splice()`로 원본 배열 자체를 수정해야 `parts` 변수에도 반영된다.

이 패턴은 `tool.execute.before`의 `output.args` 등 다른 훅에서도 동일하게 적용될 가능성이 높다.

## 관련

- OpenCode 소스: `packages/opencode/src/session/prompt.ts` (line ~1855)
- [[docs/architecture.md]] — Plugin Entry Point 섹션
- [[docs/gotcha-opencode-run-session-not-found.md]] — 또 다른 OpenCode 함정
