# Context v2: File-Based Prompt Injection Plugin

## TL;DR

> **Quick Summary**: 파일 기반 프롬프트 인젝션 OpenCode 플러그인. 프롬프트 파일 + 지식 인덱스를 매 LLM 호출 시 시스템 프롬프트에 주입.
>
> **Deliverables**:
>
> - 매 LLM 호출 시 설정된 프롬프트 파일 내용을 시스템 프롬프트에 인젝트하는 플러그인
> - AGENTS.md + docs/ 등 지식 소스 스캔 → 지식 인덱스 자동 생성 및 인젝트
> - 첫 실행 시 디렉토리 + 기본 프롬프트 파일 + config 자동 scaffold
>
> **Estimated Effort**: Short (200줄 이내의 핵심 로직)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Tasks 2-5 (parallel) → Task 6

---

## Context

### Original Request

기존 Brainstorming.md(v1)의 plan/complete/deviate/rule engine/state machine/DAG enforcement 설계가 너무 복잡함.
더 단순한 접근이 필요:

1. 에이전트 turn 시작/종료 시 원하는 프롬프트를 항상 인젝트, 프롬프트 파일로 관리
2. AGENTS.md + 문서폴더를 제텔카스텐 방식으로 지식관리/참조 (프롬프트로 유도)
3. 결과물 퀄리티 보장을 위한 린팅 등 QA 유도 (프롬프트로 유도)

### Interview Summary

**Key Discussions**:

- **Turn 정의**: 유저 메시지 ↔ 에이전트 응답 사이클 (기술적으로는 매 LLM 호출마다 동일하게 인젝트)
- **지식 저장**: 에이전트에게 프롬프트로 지시 (플러그인이 자동 수집 X)
- **QA 레벨**: 소프트 — 프롬프트 유도만 (플러그인이 직접 lint 실행 X)
- **지식 인덱스**: 파일명 + 첫 행 요약 포함
- **프롬프트 변수**: 미지원 — 정적 파일 그대로 인젝트
- **프롬프트 리로드**: 매 LLM 호출마다 파일에서 새로 읽기 (hot-reload 자동)
- **Scaffold**: 첫 실행 시 디렉토리 + 기본 파일 자동 생성
- **슬래시 커맨드**: MVP에서 제외

**Research Findings**:

- `experimental.chat.system.transform` 훅: `output.system` 배열에 push로 시스템 프롬프트 추가
- DCP/oh-my-opencode 플러그인이 이 훅을 성공적으로 활용 중
- Flat 아키텍처 (1-3 훅) 권장 for 단순 플러그인
- `@opencode-ai/plugin`을 peerDep + devDep로 추가 필요
- JSONC 파싱을 위해 `jsonc-parser` 의존성 필요

### Metis Review

**Identified Gaps** (addressed):

- 파일 읽기 실패 시 에러 핸들링 전략 → 개별 파일 skip + 경고 로그
- 지식 인덱스 크기 제한 → 최대 100개 엔트리, 첫 행 100자 truncate
- 프롬프트 파일 크기 제한 → 파일당 64KB, 총 인젝션 128KB
- Scaffold "첫 실행" 감지 → `.opencode/context/` 디렉토리 부재로 판단
- 비텍스트 파일 필터링 → .md 확장자만 스캔
- 비프로젝트 디렉토리 → 플러그인 no-op (scaffold 없이 로그만)

---

## Work Objectives

### Core Objective

파일 기반 프롬프트 인젝션 OpenCode 플러그인을 TDD로 구현. 플러그인 코드는 단순하게 유지하고, 행동의 복잡도는 프롬프트 파일 내용에 위임.

### Concrete Deliverables

- `src/index.ts` — 플러그인 진입점 (export default Plugin)
- `src/lib/config.ts` — config 로더
- `src/lib/knowledge-index.ts` — 지식 인덱스 빌더
- `src/lib/prompt-reader.ts` — 프롬프트 파일 리더
- `src/lib/scaffold.ts` — 초기 scaffold
- `src/types.ts` — 타입 정의
- `src/constants.ts` — 상수 (제한값, 기본값)
- 각 모듈의 테스트 파일 (TDD)

### Definition of Done

- [x] `bun run build` 성공 (에러 0개)
- [x] `bun test` 전체 통과
- [x] `mise run lint` 통과
- [x] 플러그인이 `experimental.chat.system.transform` 훅으로 프롬프트 인젝트 동작 확인
- [x] `.opencode/context/` 미존재 시 scaffold 자동 생성 확인

### Must Have

- `experimental.chat.system.transform` 훅을 통한 시스템 프롬프트 인젝션
- `.opencode/context/config.jsonc` 설정 파일 지원
- AGENTS.md + 설정된 문서 소스에서 지식 인덱스 자동 생성
- 프롬프트 파일 매 호출마다 fresh read
- 첫 실행 시 auto-scaffold (디렉토리 + 기본 파일)
- 모든 파일 작업에 에러 핸들링 (graceful degradation)
- TDD: 테스트 우선 작성

### Must NOT Have (Guardrails)

- ❌ 프롬프트 파일 변수 치환/템플릿 엔진 (`{{variable}}`, `{PLACEHOLDER}` 등)
- ❌ 슬래시 커맨드 (/context-status 등)
- ❌ Rule engine, state machine, DAG enforcement (v1의 복잡성)
- ❌ 플러그인의 lint/typecheck 자동 실행 (소프트 프롬프트만)
- ❌ 플러그인의 지식 자동 수집/분석/정리
- ❌ config 멀티스코프 병합 (단일 config 파일만)
- ❌ file watcher / 캐싱 (매번 파일에서 읽기)
- ❌ Custom tool 등록 (plan/complete/deviate 등)
- ❌ `console.log` 사용 (→ `client.app.log()` 사용)
- ❌ `src/index.ts`에서 함수/상수 named export (→ `export type`만 + `export default`)
- ❌ 200줄 초과의 핵심 로직 (넘기면 scope creep 의심)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: TDD (테스트 우선 작성)
- **Framework**: vitest (`describe` & `it` blocks, `expect()`)
- **If TDD**: 각 태스크는 RED (실패 테스트) → GREEN (최소 구현) → REFACTOR

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (`bun test`) — Run tests, assert pass/fail
- **Plugin Integration**: Use Bash — build + 플러그인 로드 검증

### Size Limits (Metis 권고, 모든 모듈에 적용)

- 개별 프롬프트 파일: **64KB** 최대
- 지식 인덱스 엔트리: **100개** 최대
- 총 인젝션 크기: **128KB** 최대
- 파일 스캔 깊이: **3 레벨** 최대
- 첫 행 요약: **100자** truncate
- 지식 소스 확장자: `.md`만

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — single task):
└── Task 1: Project setup + types + constants [quick]

Wave 2 (Core modules — 4 parallel):
├── Task 2: Config loader + TDD (depends: 1) [quick]
├── Task 3: Knowledge index builder + TDD (depends: 1) [quick]
├── Task 4: Prompt file reader + TDD (depends: 1) [quick]
└── Task 5: Scaffold system + TDD (depends: 1) [quick]

Wave 3 (Integration — single task):
└── Task 6: Plugin entry point + system prompt hook + integration test (depends: 2-5) [deep]

Wave FINAL (Verification — 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 2 → Task 6 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 4 (Wave 2)
```

### Dependency Matrix

| Task | Blocked By | Blocks     | Wave |
| ---- | ---------- | ---------- | ---- |
| 1    | —          | 2, 3, 4, 5 | 1    |
| 2    | 1          | 6          | 2    |
| 3    | 1          | 6          | 2    |
| 4    | 1          | 6          | 2    |
| 5    | 1          | 6          | 2    |
| 6    | 2, 3, 4, 5 | F1-F4      | 3    |

### Agent Dispatch Summary

- **Wave 1**: 1 task — T1 → `quick`
- **Wave 2**: 4 tasks — T2-T5 → `quick`
- **Wave 3**: 1 task — T6 → `deep`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs


- [x] 1. Project Setup + Types + Constants

  **What to do**:
  - `@opencode-ai/plugin`을 peerDependencies + devDependencies에 추가
  - `jsonc-parser`를 dependencies에 추가 (JSONC config 파싱용)
  - `bun install` 실행하여 의존성 설치
  - `src/types.ts` 생성:
    ```typescript
    // Plugin config type
    export interface ContextConfig {
      prompts: {
        turnStart?: string;  // 프롬프트 파일 경로 (default: .opencode/context/prompts/turn-start.md)
        turnEnd?: string;    // 프롬프트 파일 경로 (default: .opencode/context/prompts/turn-end.md)
      };
      knowledge: {
        sources: string[];   // 지식 소스 경로 목록 (default: ['AGENTS.md'])
      };
    }
    
    export interface KnowledgeEntry {
      filename: string;    // 상대 경로
      summary: string;     // 첫 비어있지 않은 행 (100자 truncate)
    }
    ```
  - `src/constants.ts` 생성:
    ```typescript
    export const DEFAULTS = {
      configPath: '.opencode/context/config.jsonc',
      promptDir: '.opencode/context/prompts',
      turnStartFile: 'turn-start.md',
      turnEndFile: 'turn-end.md',
    };
    export const LIMITS = {
      maxPromptFileSize: 64 * 1024,  // 64KB
      maxIndexEntries: 100,
      maxTotalInjectionSize: 128 * 1024,  // 128KB
      maxScanDepth: 3,
      maxSummaryLength: 100,
    };
    ```

  **Must NOT do**:
  - types.ts에서 함수/상수 export 금지 (타입만)
  - 불필요한 의존성 추가 금지
  - `console.log` 사용 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 파일 생성 + 의존성 추가. 로직 없음.
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: peerDependencies 설정, package.json 규칙 참조 필요

  **Parallelization**:
  - **Can Run In Parallel**: NO (다른 모든 태스크의 기초)
  - **Parallel Group**: Wave 1 (단독)
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: None (즉시 시작 가능)

  **References**:

  **Pattern References**:
  - `package.json` — 현재 의존성 구조. peerDep/devDep 추가 위치 확인
  - `.opencode/skills/opencode-plugin-dev/references/api-reference.md` — PluginInput, Hooks 타입 정의. ContextConfig 설계 시 PluginInput.directory 참조
  - `.opencode/skills/opencode-plugin-dev/references/patterns.md:289` — 이 프로젝트의 빌드 설정 (bun build 기반)

  **External References**:
  - `jsonc-parser` npm: https://www.npmjs.com/package/jsonc-parser — JSONC 파싱 API

  **WHY Each Reference Matters**:
  - package.json: peerDependencies에 `@opencode-ai/plugin` 추가 필수 (AGENTS.md 규칙)
  - api-reference.md: ContextConfig의 prompts/knowledge 필드가 PluginInput.directory 기준 상대경로임을 알기 위해
  - patterns.md: 빌드 방식이 bun build + tsc --emitDeclarationOnly임을 확인하기 위해

  **Acceptance Criteria**:
  - [ ] `bun install` 성공
  - [ ] `src/types.ts` 존재, ContextConfig + KnowledgeEntry 타입 export
  - [ ] `src/constants.ts` 존재, DEFAULTS + LIMITS 상수 export
  - [ ] `bun run build` 성공 (새 파일 포함)

  **QA Scenarios:**

  ```
  Scenario: Build succeeds with new files
    Tool: Bash
    Preconditions: Task 1 파일 생성 완료
    Steps:
      1. `bun run build` 실행
      2. 종료 코드 확인
      3. `dist/types.d.ts` 존재 확인
      4. `dist/constants.js` 존재 확인
    Expected Result: 종료 코드 0, 모든 dist 파일 존재
    Failure Indicators: 빌드 에러, dist 파일 누락
    Evidence: .sisyphus/evidence/task-1-build-success.txt

  Scenario: Types are correctly exported
    Tool: Bash
    Preconditions: Build 완료
    Steps:
      1. `grep 'ContextConfig' dist/types.d.ts`
      2. `grep 'KnowledgeEntry' dist/types.d.ts`
    Expected Result: 두 타입 모두 dist에 포함
    Failure Indicators: grep 결과 없음
    Evidence: .sisyphus/evidence/task-1-types-export.txt
  ```

  **Commit**: YES
  - Message: `chore(context): add project setup, types and constants`
  - Files: `package.json, bun.lock, src/types.ts, src/constants.ts`
  - Pre-commit: `bun run build`

---

- [x] 2. Config Loader (TDD)

  **What to do**:
  - `src/lib/config.test.ts` 생성 (테스트 우선):
    - `.opencode/context/config.jsonc` 정상 파싱 테스트
    - config 파일 없을 때 기본값 반환 테스트
    - JSONC (주석 포함) 파싱 테스트
    - 잘못된 JSON일 때 기본값 반환 + 에러 로그 테스트
    - config 값이 부분적일 때 기본값과 병합 테스트
  - `src/lib/config.ts` 구현:
    ```typescript
    import { parse as parseJsonc } from 'jsonc-parser';
    import { readFileSync } from 'node:fs';
    import type { ContextConfig } from '../types';
    import { DEFAULTS } from '../constants';
    
    export function loadConfig(projectDir: string): ContextConfig {
      const configPath = path.join(projectDir, DEFAULTS.configPath);
      try {
        const raw = readFileSync(configPath, 'utf-8');
        const parsed = parseJsonc(raw);
        return mergeWithDefaults(parsed);
      } catch {
        return getDefaultConfig();
      }
    }
    ```
  - 에러 핸들링: 파일 없음/파싱 실패 → 기본값 반환, 로거에 경고
  - 부분 config 지원: 누락 필드는 기본값으로 채움

  **Must NOT do**:
  - Multi-scope config 병합 (global + project) — 단일 파일만
  - Config validation beyond basic type check
  - console.log 사용

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일 TDD. 로직 단순 (파일 읽기 + JSONC 파싱 + 기본값 병합).
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: 플러그인 config 로딩 패턴 참조 (DCP 패턴)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `.opencode/skills/opencode-plugin-dev/references/patterns.md:92-122` — DCP의 loadConfig 패턴. tryLoad, deepMerge, 글로벌/프로젝트 병합 구조 참고 (단, 이 프로젝트는 단일 파일만)
  - `src/types.ts:ContextConfig` — config 타입 정의. 이 타입에 맞게 파싱/병합 구현
  - `src/constants.ts:DEFAULTS` — configPath 기본값. loadConfig에서 경로 결정에 사용

  **External References**:
  - `jsonc-parser` API: `parse(input: string)` — 주석 포함 JSON 파싱. 에러 시 undefined 반환

  **WHY Each Reference Matters**:
  - patterns.md: DCP의 tryLoad/deepMerge 패턴을 단순화해서 사용. multi-scope 없이 단일 파일 로딩만
  - types.ts: ContextConfig 구조에 맞게 기본값 생성 + 부분 config 병합
  - constants.ts: 하드코딩 대신 DEFAULTS.configPath 사용

  **Acceptance Criteria**:
  - [ ] `src/lib/config.test.ts` 존재, 최소 5개 테스트 케이스
  - [ ] `bun test src/lib/config.test.ts` → PASS (5+ tests, 0 failures)
  - [ ] `src/lib/config.ts` 존재, `loadConfig(projectDir)` 함수 export
  - [ ] config 파일 없을 때 기본값 반환 확인
  - [ ] 잘못된 JSONC일 때 기본값 반환 + 에러 안 남 확인

  **QA Scenarios:**

  ```
  Scenario: Config 정상 로딩
    Tool: Bash (bun test)
    Preconditions: Task 1 완료, types.ts/constants.ts 존재
    Steps:
      1. `bun test src/lib/config.test.ts` 실행
      2. 종료 코드 및 테스트 결과 확인
    Expected Result: 모든 테스트 통과 (5+ tests, 0 failures)
    Failure Indicators: 테스트 실패, 종료 코드 ≠ 0
    Evidence: .sisyphus/evidence/task-2-config-tests.txt

  Scenario: Config 파일 없을 때 graceful fallback
    Tool: Bash (bun test)
    Preconditions: 테스트에서 존재하지 않는 경로로 loadConfig 호출
    Steps:
      1. 해당 테스트 케이스가 에러 없이 기본값 반환 검증
    Expected Result: ContextConfig 기본값 반환, 에러 throw 없음
    Failure Indicators: Error throw, undefined 반환
    Evidence: .sisyphus/evidence/task-2-config-fallback.txt
  ```

  **Commit**: YES
  - Message: `feat(context): add config loader with TDD`
  - Files: `src/lib/config.ts, src/lib/config.test.ts`
  - Pre-commit: `bun test src/lib/config.test.ts`

---

- [x] 3. Knowledge Index Builder (TDD)

  **What to do**:
  - `src/lib/knowledge-index.test.ts` 생성 (테스트 우선):
    - 단일 .md 파일 스캔 → 파일명 + 첫 행 요약 반환
    - 디렉토리 스캔 → 모든 .md 파일 나열
    - .md 외 파일 무시 테스트 (.txt, .jpg 등)
    - 빈 디렉토리 → 빈 배열 반환
    - 최대 100개 엔트리 제한 테스트
    - 첫 행이 빈 줄일 때 다음 비어있지 않은 행 찾기
    - 첫 행 100자 초과 시 truncate
    - 존재하지 않는 경로 → 빈 배열 반환 (에러 X)
    - 스캔 깊이 3레벨 제한 테스트
  - `src/lib/knowledge-index.ts` 구현:
    ```typescript
    import type { KnowledgeEntry } from '../types';
    import { LIMITS } from '../constants';
    
    export function buildKnowledgeIndex(
      projectDir: string,
      sources: string[]
    ): KnowledgeEntry[] {
      // 1. sources 배열 순회
      // 2. 각 source가 파일이면 직접 처리
      // 3. 디렉토리면 재귀적 스캔 (maxDepth=3)
      // 4. .md 확장자만 필터링
      // 5. 첫 비어있지 않은 행 추출, 100자 truncate
      // 6. maxIndexEntries 제한 적용
    }
    
    export function formatKnowledgeIndex(entries: KnowledgeEntry[]): string {
      // 인덱스를 markdown 문자열로 포맷팅
      // 예: '- AGENTS.md — # Project Guide'
    }
    ```

  **Must NOT do**:
  - .md 외 확장자 파일 포함
  - 3레벨 초과 깊이 스캔
  - 파일 내용 전체 읽기 (첫 행만)
  - 100개 초과 엔트리 포함

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 모듈 TDD. 파일 시스템 스캔 + 텍스트 추출 로직.
  - **Skills**: []
    - 플러그인 특화 지식 불필요. 순수 Node.js 파일 시스템 API.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/types.ts:KnowledgeEntry` — 인덱스 엔트리 타입. filename, summary 필드 구조
  - `src/constants.ts:LIMITS` — maxIndexEntries(100), maxScanDepth(3), maxSummaryLength(100) 제한값
  - `AGENTS.md` — 실제 지식 소스 예시. 첫 행 형태 참고 ('# AGENTS.md')

  **WHY Each Reference Matters**:
  - types.ts: KnowledgeEntry 타입에 맞게 반환값 구성
  - constants.ts: 하드코딩 대신 LIMITS 상수 사용하여 제한값 적용
  - AGENTS.md: 실제 파일의 첫 행이 '# AGENTS.md'임을 알아야 추출 로직 설계 가능

  **Acceptance Criteria**:
  - [ ] `src/lib/knowledge-index.test.ts` 존재, 최소 8개 테스트 케이스
  - [ ] `bun test src/lib/knowledge-index.test.ts` → PASS (8+ tests, 0 failures)
  - [ ] `src/lib/knowledge-index.ts` 존재, `buildKnowledgeIndex` + `formatKnowledgeIndex` export
  - [ ] .md 외 파일 무시 동작 확인
  - [ ] 100개 초과 시 truncation 동작 확인

  **QA Scenarios:**

  ```
  Scenario: 정상 디렉토리 스캔
    Tool: Bash (bun test)
    Preconditions: tmp 디렉토리에 test.md, README.md, image.png 생성
    Steps:
      1. `bun test src/lib/knowledge-index.test.ts` 실행
      2. 테스트 결과 확인
    Expected Result: .md 파일 2개만 인덱스에 포함, .png 제외
    Failure Indicators: .png 파일이 인덱스에 포함되거나 .md 누락
    Evidence: .sisyphus/evidence/task-3-index-scan.txt

  Scenario: 엔트리 제한 초과
    Tool: Bash (bun test)
    Preconditions: tmp 디렉토리에 150개 .md 파일 생성
    Steps:
      1. buildKnowledgeIndex 호출 후 반환값 길이 확인
    Expected Result: 정확히 100개 엔트리 반환
    Failure Indicators: 100 초과 또는 0개
    Evidence: .sisyphus/evidence/task-3-index-limit.txt
  ```

  **Commit**: YES
  - Message: `feat(context): add knowledge index builder with TDD`
  - Files: `src/lib/knowledge-index.ts, src/lib/knowledge-index.test.ts`
  - Pre-commit: `bun test src/lib/knowledge-index.test.ts`

---

- [x] 4. Prompt File Reader (TDD)

  **What to do**:
  - `src/lib/prompt-reader.test.ts` 생성 (테스트 우선):
    - 정상 파일 읽기 → 내용 반환
    - 파일 없을 때 → 빈 문자열 반환 (에러 X)
    - 64KB 초과 파일 → truncate + 경고 로그
    - UTF-8 인코딩 확인
  - `src/lib/prompt-reader.ts` 구현:
    ```typescript
    import { LIMITS } from '../constants';
    
    export function readPromptFile(filePath: string): string {
      try {
        const content = readFileSync(filePath, 'utf-8');
        if (content.length > LIMITS.maxPromptFileSize) {
          // truncate + log warning
          return content.slice(0, LIMITS.maxPromptFileSize);
        }
        return content;
      } catch {
        return '';  // graceful: 파일 없으면 빈 문자열
      }
    }
    ```

  **Must NOT do**:
  - 파일 내용 변환/처리 (정적 파일 그대로)
  - 변수 치환 로직
  - 캐싱 (매번 새로 읽기)
  - 파일 읽기 실패 시 Error throw

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 아주 단순한 모듈. 파일 읽기 + 사이즈 체크가 전부.
  - **Skills**: []
    - 플러그인 특화 지식 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/constants.ts:LIMITS` — maxPromptFileSize(64KB) 제한값. truncate 로직에 사용
  - `AGENTS.md` — 에러 핸들링 패턴: `error instanceof Error ? error.toString() : String(error)` 참조

  **WHY Each Reference Matters**:
  - constants.ts: 하드코딩 대신 LIMITS.maxPromptFileSize 사용
  - AGENTS.md: 에러 핸들링 규칙 준수 (catch에서 error 타입 체크)

  **Acceptance Criteria**:
  - [ ] `src/lib/prompt-reader.test.ts` 존재, 최소 4개 테스트 케이스
  - [ ] `bun test src/lib/prompt-reader.test.ts` → PASS (4+ tests, 0 failures)
  - [ ] `src/lib/prompt-reader.ts` 존재, `readPromptFile` 함수 export
  - [ ] 파일 없을 때 빈 문자열 반환 확인

  **QA Scenarios:**

  ```
  Scenario: 프롬프트 파일 정상 읽기
    Tool: Bash (bun test)
    Preconditions: tmp 파일에 'Hello World' 작성
    Steps:
      1. `bun test src/lib/prompt-reader.test.ts` 실행
    Expected Result: 테스트 전체 통과 (4+ tests, 0 failures)
    Failure Indicators: 테스트 실패
    Evidence: .sisyphus/evidence/task-4-prompt-reader.txt

  Scenario: 파일 없을 때 graceful fallback
    Tool: Bash (bun test)
    Preconditions: 존재하지 않는 경로로 readPromptFile 호출
    Steps:
      1. 해당 테스트 케이스가 '' 반환 검증
    Expected Result: 빈 문자열 반환, throw 없음
    Failure Indicators: Error throw, null/undefined 반환
    Evidence: .sisyphus/evidence/task-4-prompt-fallback.txt
  ```

  **Commit**: YES
  - Message: `feat(context): add prompt file reader with TDD`
  - Files: `src/lib/prompt-reader.ts, src/lib/prompt-reader.test.ts`
  - Pre-commit: `bun test src/lib/prompt-reader.test.ts`

---

- [x] 5. Scaffold System (TDD)

  **What to do**:
  - `src/lib/scaffold.test.ts` 생성 (테스트 우선):
    - `.opencode/context/` 없을 때 전체 구조 생성 테스트
    - 이미 존재할 때 아무것도 안 함 (먱등성)
    - 생성된 파일 내용 검증 (config.jsonc, turn-start.md, turn-end.md)
    - 권한 오류 시 graceful 실패 (에러 로그만, crash X)
  - `src/lib/scaffold.ts` 구현:
    ```typescript
    import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
    import { DEFAULTS } from '../constants';
    
    export function scaffoldIfNeeded(projectDir: string): boolean {
      const contextDir = path.join(projectDir, '.opencode/context');
      if (existsSync(contextDir)) return false;  // 이미 존재
      
      mkdirSync(path.join(contextDir, 'prompts'), { recursive: true });
      writeFileSync(
        path.join(contextDir, 'config.jsonc'),
        DEFAULT_CONFIG_CONTENT
      );
      writeFileSync(
        path.join(contextDir, 'prompts/turn-start.md'),
        DEFAULT_TURN_START_CONTENT
      );
      writeFileSync(
        path.join(contextDir, 'prompts/turn-end.md'),
        DEFAULT_TURN_END_CONTENT
      );
      return true;  // scaffold 수행됨
    }
    ```
  - 기본 config.jsonc 내용:
    ```jsonc
    {
      // Context Plugin Configuration
      "prompts": {
        "turnStart": ".opencode/context/prompts/turn-start.md",
        "turnEnd": ".opencode/context/prompts/turn-end.md"
      },
      "knowledge": {
        "sources": ["AGENTS.md"]
      }
    }
    ```
  - 기본 turn-start.md 내용:
    ```markdown
    ## Knowledge Context
    
    이 프로젝트의 지식 베이스를 참고하여 작업하세요.
    - 작업과 관련된 지식 파일이 있으면 먼저 읽고 참조하세요
    - 지식 간 [[링크]]를 따라가며 관련 컨텍스트를 파악하세요
    - AGENTS.md의 지시사항을 준수하세요
    ```
  - 기본 turn-end.md 내용:
    ```markdown
    ## 작업 마무리 체크리스트
    
    작업을 완료하기 전에 반드시:
    
    ### 퀄리티 보장
    - [ ] 변경한 코드에 대해 lint 실행
    - [ ] 타입 에러 확인
    - [ ] 기존 테스트 통과 확인
    
    ### 지식 정리
    - [ ] 새로 알게 된 중요한 패턴/결정이 있으면 지식 파일로 정리
    ```

  **Must NOT do**:
  - 이미 존재하는 파일 덮어쓰기 (멱등성 필수)
  - 권한 에러 시 crash (로그만)
  - 복잡한 템플릿 엔진으로 기본 파일 생성

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 파일 생성 + 존재 여부 체크. 로직 최소.
  - **Skills**: []
    - 플러그인 특화 지식 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/constants.ts:DEFAULTS` — 파일 경로 기본값 (configPath, promptDir, turnStartFile, turnEndFile)
  - `.sisyphus/drafts/brainstorm2.md` — 사용자가 확정한 프롬프트 파일 내용 및 구조

  **WHY Each Reference Matters**:
  - constants.ts: 기본 경로가 DEFAULTS에 정의되어 있으므로 참조 필수
  - brainstorm2.md: 사용자가 확정한 기본 프롬프트 파일 내용 참고

  **Acceptance Criteria**:
  - [ ] `src/lib/scaffold.test.ts` 존재, 최소 4개 테스트 케이스
  - [ ] `bun test src/lib/scaffold.test.ts` → PASS (4+ tests, 0 failures)
  - [ ] `src/lib/scaffold.ts` 존재, `scaffoldIfNeeded` 함수 export
  - [ ] scaffold 후 config.jsonc, turn-start.md, turn-end.md 모두 존재
  - [ ] 이미 존재할 때 덮어쓰기 없음 확인

  **QA Scenarios:**

  ```
  Scenario: 초기 scaffold 생성
    Tool: Bash (bun test)
    Preconditions: 빈 tmp 디렉토리
    Steps:
      1. `bun test src/lib/scaffold.test.ts` 실행
    Expected Result: 테스트 전체 통과 (4+ tests, 0 failures)
    Failure Indicators: 테스트 실패
    Evidence: .sisyphus/evidence/task-5-scaffold.txt

  Scenario: 멱등성 테스트
    Tool: Bash (bun test)
    Preconditions: 이미 scaffold된 디렉토리
    Steps:
      1. scaffoldIfNeeded 두 번 호출
      2. 첫 번째 true, 두 번째 false 반환 확인
      3. 파일 내용 변경 없음 확인
    Expected Result: 두 번째 호출에서 false 반환, 파일 동일
    Failure Indicators: 파일 덮어쓰기 또는 에러
    Evidence: .sisyphus/evidence/task-5-idempotent.txt
  ```

  **Commit**: YES
  - Message: `feat(context): add scaffold system with TDD`
  - Files: `src/lib/scaffold.ts, src/lib/scaffold.test.ts`
  - Pre-commit: `bun test src/lib/scaffold.test.ts`

---

- [x] 6. Plugin Entry Point + System Prompt Hook + Integration Test

  **What to do**:
  - `src/index.test.ts` 생성 (테스트 우선 — 통합 테스트):
    - 플러그인 함수 호출 → Hooks 객체 반환 테스트
    - Hooks에 `experimental.chat.system.transform` 존재 테스트
    - 훅 호출 시 output.system에 3개 블록 추가 테스트 (turn-start + index + turn-end)
    - scaffold 되지 않은 상태에서 시작 → scaffold 후 인젝션 동작
    - 프롬프트 파일 변경 후 재호출 → 새 내용 인젝트 (hot-reload 검증)
    - 에러 상황 (config 없음, 프롬프트 없음) → crash 없이 동작
    - 총 인젝션 128KB 초과 시 truncation
  - `src/index.ts` 구현:
    ```typescript
    import type { Plugin } from '@opencode-ai/plugin';
    import { loadConfig } from './lib/config';
    import { buildKnowledgeIndex, formatKnowledgeIndex } from './lib/knowledge-index';
    import { readPromptFile } from './lib/prompt-reader';
    import { scaffoldIfNeeded } from './lib/scaffold';
    import { DEFAULTS, LIMITS } from './constants';
    
    const plugin: Plugin = async ({ directory, client }) => {
      // 1. Scaffold if first run
      const scaffolded = scaffoldIfNeeded(directory);
      if (scaffolded) {
        client.app.log({ body: {
          service: 'context', level: 'info',
          message: 'Scaffold created at .opencode/context/'
        }});
      }
      
      // 2. Load config
      const config = loadConfig(directory);
      
      return {
        'experimental.chat.system.transform': async (_input, output) => {
          // 3. Read prompt files (fresh every call = hot-reload)
          const turnStart = readPromptFile(
            path.resolve(directory, config.prompts.turnStart ?? DEFAULTS.promptDir + '/' + DEFAULTS.turnStartFile)
          );
          const turnEnd = readPromptFile(
            path.resolve(directory, config.prompts.turnEnd ?? DEFAULTS.promptDir + '/' + DEFAULTS.turnEndFile)
          );
          
          // 4. Build knowledge index
          const entries = buildKnowledgeIndex(directory, config.knowledge.sources);
          const indexContent = formatKnowledgeIndex(entries);
          
          // 5. Inject into system prompt
          if (turnStart) output.system.push(turnStart);
          if (indexContent) output.system.push(indexContent);
          if (turnEnd) output.system.push(turnEnd);
        },
      };
    };
    
    export default plugin;
    ```
  - **주의**: `src/index.ts`에서 `export default plugin`만. 함수/상수 named export 금지 (AGENTS.md 규칙)
  - **주의**: `console.log` 대신 `client.app.log()` 사용 (AGENTS.md 규칙)

  **Must NOT do**:
  - `src/index.ts`에서 함수/상수 named export
  - `console.log` 사용
  - 슬래시 커맨드 등록 (MVP 제외)
  - tool 등록 (plan/complete/deviate 등 v1 복잡성)
  - 캐싱 로직 추가
  - 에러 시 crash (graceful degradation 필수)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 모든 모듈 통합 + 통합 테스트. 여러 모듈 조합 및 엣지 케이스 처리 필요.
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: Plugin 타입, Hooks 인터페이스, export 규칙, client.app.log() 패턴 필수 참조

  **Parallelization**:
  - **Can Run In Parallel**: NO (모든 Wave 2 태스크 의존)
  - **Parallel Group**: Wave 3 (단독)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 2, 3, 4, 5

  **References**:

  **Pattern References**:
  - `.opencode/skills/opencode-plugin-dev/references/api-reference.md:13-21` — PluginInput 타입: directory, client 파라미터 구조
  - `.opencode/skills/opencode-plugin-dev/references/api-reference.md:125-129` — `experimental.chat.system.transform` 훅 시그니처: input.sessionID, output.system 배열
  - `.opencode/skills/opencode-plugin-dev/references/patterns.md:177-183` — 시스템 프롬프트 주입 패턴: output.system.push() 사용법
  - `.opencode/skills/opencode-plugin-dev/references/api-reference.md:256-261` — client.app.log() API: service, level, message 필드
  - `src/lib/config.ts:loadConfig` — Config 로더 API. plugin에서 호출하여 config 획득
  - `src/lib/knowledge-index.ts:buildKnowledgeIndex, formatKnowledgeIndex` — 인덱스 빌드/포맷 API
  - `src/lib/prompt-reader.ts:readPromptFile` — 프롬프트 파일 리더 API
  - `src/lib/scaffold.ts:scaffoldIfNeeded` — Scaffold API
  - `src/constants.ts:DEFAULTS, LIMITS` — 기본 경로와 제한값

  **WHY Each Reference Matters**:
  - api-reference.md: Plugin/Hooks 타입을 정확히 따라야 플러그인이 로드됨
  - patterns.md: output.system.push() 패턴을 정확히 따라야 시스템 프롬프트에 인젝트됨
  - 각 lib 모듈: Task 2-5에서 구현된 API를 정확히 호출해야 함

  **Acceptance Criteria**:
  - [ ] `src/index.ts` 존재, `export default plugin` (Plugin 타입)
  - [ ] `src/index.ts`에 함수/상수 named export 없음 (export type만 허용)
  - [ ] `src/index.test.ts` 존재, 최소 7개 테스트 케이스
  - [ ] `bun test src/index.test.ts` → PASS (7+ tests, 0 failures)
  - [ ] `bun test` (전체) → PASS
  - [ ] `bun run build` 성공
  - [ ] `mise run lint` 통과
  - [ ] `console.log` 없음 확인 (grep)
  - [ ] index.ts에서 named function/const export 없음 확인 (grep)

  **QA Scenarios:**

  ```
  Scenario: 플러그인 전체 통합 테스트
    Tool: Bash (bun test)
    Preconditions: Tasks 1-5 완료
    Steps:
      1. `bun test` 실행 (전체 테스트)
      2. 종료 코드 확인
    Expected Result: 모든 테스트 통과 (28+ tests across all files, 0 failures)
    Failure Indicators: 테스트 실패, 종료 코드 ≠ 0
    Evidence: .sisyphus/evidence/task-6-full-test.txt

  Scenario: 빌드 성공 및 코드 품질
    Tool: Bash
    Preconditions: 모든 소스 파일 작성 완료
    Steps:
      1. `bun run build` 실행 → 종료 코드 0 확인
      2. `mise run lint` 실행 → 종료 코드 0 확인
      3. `grep -r 'console.log' src/` → 결과 없음 확인
      4. `grep -E 'export (function|const|let|var)' src/index.ts` → 결과 없음 확인
    Expected Result: 빌드/린트 통과, console.log 없음, named export 없음
    Failure Indicators: 빌드 실패, 린트 에러, 금지된 패턴 발견
    Evidence: .sisyphus/evidence/task-6-build-quality.txt

  Scenario: Hot-reload 동작 검증
    Tool: Bash (bun test)
    Preconditions: 통합 테스트에 hot-reload 케이스 포함
    Steps:
      1. 테스트에서: 프롬프트 파일 "OLD" 내용으로 훅 호출
      2. 파일 내용 "NEW"로 변경
      3. 훅 다시 호출
      4. output.system에 "NEW" 포함 확인
    Expected Result: 두 번째 호출에서 "NEW" 인젝트됨
    Failure Indicators: 여전히 "OLD" 인젝트됨 (캐싱 버그)
    Evidence: .sisyphus/evidence/task-6-hot-reload.txt
  ```

  **Commit**: YES
  - Message: `feat(context): wire plugin entry point with system prompt hook`
  - Files: `src/index.ts, src/index.test.ts`
  - Pre-commit: `bun test && bun run build && mise run lint`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
      Run `bun run build` + `mise run lint` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify total core logic < 200 lines.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
      Start from clean state (`rm -rf .opencode/context/`). Verify:
  1. Plugin loads without errors
  2. Scaffold creates expected files
  3. Config is parsed correctly
  4. Knowledge index reflects actual files
  5. System prompt contains injected content
     Save to `.sisyphus/evidence/final-qa/`.
     Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag if core logic exceeds 200 lines.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Task 1**: `chore(context): add project setup, types and constants` — types.ts, constants.ts, package.json
- **Task 2**: `feat(context): add config loader with TDD` — lib/config.ts, lib/config.test.ts
- **Task 3**: `feat(context): add knowledge index builder with TDD` — lib/knowledge-index.ts, lib/knowledge-index.test.ts
- **Task 4**: `feat(context): add prompt file reader with TDD` — lib/prompt-reader.ts, lib/prompt-reader.test.ts
- **Task 5**: `feat(context): add scaffold system with TDD` — lib/scaffold.ts, lib/scaffold.test.ts
- **Task 6**: `feat(context): wire plugin entry point with system prompt hook` — index.ts, integration test

---

## Success Criteria

### Verification Commands

```bash
bun run build           # Expected: Build succeeds, dist/ generated
bun test                # Expected: All tests pass
mise run lint           # Expected: No lint errors
```

### Final Checklist

- [x] All "Must Have" items implemented and verified
- [x] All "Must NOT Have" items absent from codebase
- [x] All tests pass (`bun test`)
- [x] Build succeeds (`bun run build`)
- [x] Lint passes (`mise run lint`)
- [x] Plugin loads and injects prompts correctly
- [x] Scaffold creates expected file structure
- [x] Core logic under 200 lines
