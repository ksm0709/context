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

<!-- context:start -->
## Knowledge Context

이 프로젝트는 **제텔카스텐(Zettelkasten)** 방식으로 지식을 관리합니다.
세션 간 컨텍스트를 보존하여, 이전 세션의 결정/패턴/실수가 다음 세션에서 재활용됩니다.

### 제텔카스텐 핵심 원칙

1. **원자성** -- 하나의 노트 = 하나의 주제. 여러 주제를 섞지 마세요.
2. **연결** -- 모든 노트는 [[wikilink]]로 관련 노트에 연결. 고립된 노트는 발견되지 않습니다.
3. **자기 언어** -- 복사-붙여넣기가 아닌, 핵심을 이해하고 간결하게 서술하세요.

### 작업 전 필수

- 메인 에이전트가 아래 **Available Knowledge** 목록에서 현재 작업과 관련된 문서를 **직접 먼저** 읽으세요
- 도메인 폴더 구조가 있다면 INDEX.md의 요약을 참고하여 필요한 노트만 선택적으로 읽으세요
- 문서 내 [[링크]]를 따라가며 관련 노트를 탐색하세요 -- 링크를 놓치면 중요한 맥락을 잃습니다
- 지식 파일에 기록된 아키텍처 결정, 패턴, 제약사항을 반드시 따르세요
- 읽은 지식을 현재 작업의 설계, 구현, 검증에 직접 반영하세요

### 개발 원칙

- **TDD** (Test-Driven Development): 테스트를 먼저 작성하고(RED), 구현하여 통과시킨 뒤(GREEN), 리팩토링하세요
- **DDD** (Domain-Driven Design): 도메인 개념을 코드 구조에 반영하세요. 타입과 모듈은 비즈니스 도메인을 기준으로 분리하세요
- **테스트 커버리지**: 새로 작성하거나 변경한 코드는 테스트 커버리지 80% 이상을 목표로 하세요. 구현 전에 테스트부터 작성하면 자연스럽게 달성됩니다

### 우선순위

- AGENTS.md의 지시사항이 항상 최우선
- 지식 노트의 결정사항 > 일반적 관행
- 지식 노트에 없는 새로운 결정이나 반복 가치가 있는 발견은 작업 메모나 지식 노트 후보로 기록하세요


## Available Knowledge

- docs/INDEX.md — # Knowledge Index
- docs/adr-001-zettelkasten-hook-templates.md — # ADR-001: 제텔카스텐 훅 콘텐츠 + 8개 개별 노트 템플릿
- docs/adr-002-domain-index-knowledge-structure.md — # ADR-002: 도메인 폴더 + INDEX.md 기반 지식 구조
- docs/adr-003-omx-compatibility.md — # ADR-003: OMX 호환성 및 turn-end 주입 전략
- docs/architecture.md — # Plugin Architecture
- docs/archive/subagent/decision-remove-subagent-turn-end.md — # Decision: subagentTurnEnd 설정 제거
- docs/archive/subagent/decision-subagent-infinite-loop-prevention.md — # Decision: 서브에이전트 무한루프 방지를 위한 하이브리드 차단 도입
- docs/archive/subagent/decision-subagent-session-detection.md — # Decision: 서브에이전트 세션 감지를 위한 parentID 기반 유틸리티 도입
- docs/archive/subagent/decision-turn-start-subagent-delegation.md — # Decision: turnStart 프롬프트에 지식 노트 탐색을 서브에이전트에 위임
- docs/bug-knowledge-index-spatial-mismatch.md — # Bug: knowledge index가 turn-start와 다른 위치에 주입되어 공간적 참조 깨짐
- docs/bug-update-plugin-npm-global-not-detected.md — # Bug: context update plugin이 npm/nvm 글로벌 설치를 감지·갱신하지 못함
- docs/decision-cli-tool-over-opencode-command.md — # Decision: /context-update 커맨드 제거 → CLI 도구로 대체
- docs/decision-cli-update-subcommands.md — # Decision: CLI update 커맨드 서브커맨드 체계 도입
- docs/decision-omx-turn-end-investigation.md — # Decision: OMX 환경에서의 turn-end 주입 조사
- docs/decision-remove-subagent-delegation.md — # Decision: Remove Subagent Delegation from Prompt Flow
- docs/decision-remove-version-ts.md — # Decision: src/version.ts 제거 → package.json에서 직접 읽기
- docs/decision-scaffold-auto-update-scope.md — # Decision: 스캐폴드 자동 업데이트 시 templates만 갱신
- docs/decision-update-test-mocking.md — # Decision: Vitest ESM 모듈 모킹 시 vi.spyOn 대신 vi.mock 사용
- docs/gotcha-bun-cli-node-reference-error.md — # Gotcha: Bun CLI -- node로 실행 시 "Bun is not defined" 레퍼런스 에러
- docs/gotcha-bun-global-cli-version-mismatch.md — # Gotcha: Bun -- 글로벌 CLI 버전 불일치
- docs/gotcha-bun-global-reference-error.md — # Gotcha: Bun -- 테스트 환경에서 전역 객체 Bun 직접 참조 시 ReferenceError
- docs/gotcha-bun-html-comment-template-literal.md — # Gotcha: Bun -- TypeScript 템플릿 리터럴 내 <!-- HTML 주석 파싱 버그
- docs/gotcha-bun-test-vitest-api-incompatibility.md — # Gotcha: Bun -- bun test로 Vitest 전용 API 실행 시 TypeError
- docs/gotcha-bun-vitest-esm-spy-error.md — # Gotcha: Vitest -- ESM 모듈의 함수 모킹 시 Module namespace 에러
- docs/gotcha-bun-vitest-global-reference-error.md — # Gotcha: Bun -- Vitest 환경에서 전역 객체 직접 참조 시 ReferenceError
- docs/gotcha-bun-vitest-mocking.md — # Gotcha: Vitest -- Bun 전역 객체 모킹 시 ReferenceError
- docs/gotcha-eslint-no-unused-vars-function-type-params.md — # Gotcha: eslint -- no-unused-vars가 함수 타입 파라미터명을 unused로 잡음
- docs/gotcha-github-actions-manual-tag-publish.md — # Gotcha: GitHub Actions -- 수동 태그 푸시 후 npm 자동 배포 안 됨
- docs/gotcha-npm-unpublish-dependent-packages.md — # Gotcha: npm -- unpublish 차단 (dependent packages)
- docs/gotcha-opencode-command-hook-parts-mutation.md — # Gotcha: @opencode-ai/plugin -- command.execute.before에서 output.parts 재할당 무시됨
- docs/gotcha-opencode-plugin-cache-version-mismatch.md — # Gotcha: OpenCode -- 플러그인 캐시 버전 불일치
- docs/gotcha-opencode-run-session-not-found.md — # Gotcha: opencode 1.2.15 -- `opencode run`이 Session not found로 크래시
- docs/gotcha-opencode-status-plugin-name-dist.md — # Gotcha: OpenCode -- /status에서 플러그인 이름이 "dist"로 표시됨
- docs/insight-omx-team-worker-turn-end-guard.md — # Insight: OMX team worker turn-end guard verification
- docs/insight-omx-turn-end-followup-loop.md — # Insight: OMX turn-end follow-up loop suppression
- docs/insight-opencode-plugin-loading-debugging.md — # Insight: OpenCode 플러그인 로딩 디버깅 (완결)
- docs/omx-setup.md — # OMX Setup Guide
- docs/pattern-bun-vitest-esm-mocking.md — # Pattern: Bun/Vitest ESM Mocking
- docs/pattern-d8-prompt-markers.md — # Pattern: D8 Prompt Markers
- docs/pattern-prompt-template-variables.md — # Pattern: Prompt Template Variable Resolution
- docs/runbook-context-plugin-release.md — # Runbook: @ksm0709/context 릴리즈 후 캐시 동기화
- docs/runbook-github-actions-trusted-publishing.md — # Runbook: GitHub Actions Trusted Publishing 설정 및 활용
- docs/synthetic-message-injection.md — # Synthetic 메시지 주입의 한계와 대안
- AGENTS.md — # AGENTS.md
<!-- context:end -->
