# AGENTS.md

## Build & Test Commands

- **Build**: `mise run build` or `bun build ./src/index.ts --outdir dist --target bun`
- **Test**: `mise run test` or `npx vitest run` (⚠️ `bun test` 사용 금지 — [[docs/gotcha-bun-test-vitest-api-incompatibility.md]])
- **Single Test**: `npx vitest run config.test.ts` (use file glob pattern)
- **Watch Mode**: `npx vitest --watch`
- **Lint**: `mise run lint` (eslint)
- **Fix Lint**: `mise run lint:fix` (eslint --fix)
- **Format**: `mise run format` (prettier)

## Code Style Guidelines

### Imports & Module System

- Use ES6 `import`/`export` syntax (module: "ESNext", type: "module")
- Group imports: external libraries first, then internal modules
- Use explicit file extensions (`.ts`) for internal imports

### Formatting (Prettier)

- **Single quotes** (`singleQuote: true`)
- **Line width**: 100 characters
- **Tab width**: 2 spaces
- **Trailing commas**: ES5 (no trailing commas in function parameters)
- **Semicolons**: enabled

### TypeScript & Naming

- **NeverNesters**: avoid deeply nested structures. Always exit early.
- **Strict mode**: enforced (`"strict": true`)
- **Interfaces**: PascalCase (e.g., `ContextConfig`, `KnowledgeEntry`)
- **Methods/properties**: camelCase
- **Status strings**: use union types (e.g., `'pending' | 'running' | 'completed' | 'failed' | 'cancelled'`)
- **Explicit types**: prefer explicit type annotations over inference
- **Return types**: optional (not required but recommended for public methods)

### Error Handling

- Check error type before accessing error properties: `error instanceof Error ? error.toString() : String(error)`
- Log errors with `[ERROR]` prefix for consistency
- Always provide error context when recording output

### Linting Rules

- `@typescript-eslint/no-explicit-any`: warn (avoid `any` type)
- `no-console`: error (minimize console logs)
- `prettier/prettier`: error (formatting violations are errors)

## Testing

- Framework: **vitest** with `describe` & `it` blocks
- Style: Descriptive nested test cases with clear expectations
- Assertion library: `expect()` (vitest)

## Memory

- Store temporary data in `.memory/` directory (gitignored)

## Project Context

- **Type**: OpenCode plugin package (`@ksm0709/context`)
- **Target**: Bun runtime, ES2021+ / ESM
- **Purpose**: OpenCode context plugin — Zettelkasten 기반 지식 관리 및 프롬프트 주입
- **Plugin API**: `@opencode-ai/plugin` (peerDep) + `@opencode-ai/sdk`
- **Install**: `opencode.json` → `"plugin": ["@ksm0709/context"]`

## Plugin Development

**Skill**: 이 프로젝트에서 작업할 때 항상 `opencode-plugin-dev` 스킬을 로드.
`.opencode/skills/opencode-plugin-dev/` — API 레퍼런스, 아키텍처 패턴, 검증된 구현 예시 포함.

**Skill 업데이트 원칙**: 플러그인 개발 중 새로운 중요 내용을 발견하면, 스킬에 기재되지 않은 내용일 경우 즉시 해당 스킬 파일을 업데이트.

- 어디에 기재할지 판단 기준:
  - 훅 시그니처/타입 변경 → `references/api-reference.md`
  - 구현 패턴/아키텍처 결정 → `references/patterns.md`
  - 자주 쓰는 핵심 패턴 (3줄 이내) → `SKILL.md` 인라인
- 업데이트 후 별도 보고 불필요. 작업 흐름에서 조용히 처리.

### 핵심 규칙

- `src/index.ts`에서 `export type` 만 허용. 함수/상수 named export 절대 금지
  → OpenCode가 모든 export를 플러그인 인스턴스로 호출하기 때문
- `export default Plugin` 필수
- `console.log` 금지 → `client.app.log()` 사용 (ESLint `no-console` 적용)
- `@opencode-ai/plugin` → `peerDependencies` (devDependencies에도 추가)

### 파일 구조

```
src/
├── index.ts              ← 플러그인 진입점 (export default plugin)
├── types.ts              ← ContextConfig, KnowledgeEntry 인터페이스
├── constants.ts          ← DEFAULTS (경로), LIMITS (크기 제한)
├── index.test.ts
└── lib/
    ├── config.ts          ← loadConfig: JSONC 설정 파일 로드 + 기본값 병합
    ├── config.test.ts
    ├── knowledge-index.ts ← buildKnowledgeIndex: docs/ 스캔, formatKnowledgeIndex: 마크다운 포맷
    ├── knowledge-index.test.ts
    ├── prompt-reader.ts   ← readPromptFile: 파일 읽기 + 64KB 제한
    ├── prompt-reader.test.ts
    ├── scaffold.ts        ← scaffoldIfNeeded: 초기 생성, updateScaffold: /context-update 명령
    └── scaffold.test.ts
docs/                       ← Zettelkasten 지식 베이스 (knowledge index 대상)
├── architecture.md
├── adr-*.md              ← Architecture Decision Records
├── bug-*.md              ← 버그 분석 노트
└── synthetic-message-injection.md
.opencode/
└── skills/
    └── opencode-plugin-dev/   ← 플러그인 개발 스킬
        ├── SKILL.md
        └── references/
            ├── api-reference.md   ← @opencode-ai/plugin 전체 타입
            └── patterns.md        ← 아키텍처/상태/빌드 패턴
```

### Plugin Hooks 사용

| Hook                                   | 용도                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `config`                               | `/context-update` 커맨드 등록                                                                         |
| `command.execute.before`               | `/context-update` 실행 시 scaffold 파일 업데이트                                                      |
| `experimental.chat.messages.transform` | turn-start 프롬프트 + knowledge index를 마지막 user 메시지에 주입, turn-end를 별도 user 메시지로 추가 |
