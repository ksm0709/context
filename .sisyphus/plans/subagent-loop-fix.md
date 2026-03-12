# Fix: Subagent Infinite Delegation Loop Prevention

## TL;DR

> **Quick Summary**: 서브에이전트가 turn-start/turn-end의 "서브에이전트에 위임하라" 지시를 받아 무한 루프에 빠지는 문제를, D8 마커 기반 프롬프트 필터링 + Session.parentID 기반 구조적 감지로 해결한다.
>
> **Deliverables**:
>
> - `filterByAgentType()` 유틸리티 — HTML 주석 마커로 에이전트 유형별 콘텐츠 필터링
> - `isSubagentSession()` 유틸리티 — parentID 기반 구조적 서브에이전트 감지 + 세션 캐시
> - D8 마커가 적용된 turn-start.md / turn-end.md 기본 템플릿
> - 이름 기반 감지(`session.agent` 매칭) 완전 제거
> - `subagent-turn-end.md` 별도 파일 체계 완전 제거
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves (4 → 3 → 1 tasks)
> **Critical Path**: Task 1/2 → Task 6 → Task 8 → F1-F4

---

## Context

### Original Request

서브에이전트가 메인 에이전트와 동일한 turn-start/turn-end 프롬프트를 받아, "서브에이전트에 위임하라"는 지시를 따라 무한 재귀 호출하는 문제 해결. 2가지 방안 동시 진행:

1. D8 마커 기반 프롬프트 필터링
2. Session.parentID 기반 구조적 서브에이전트 감지

### 코드베이스 검증 결과

**서브에이전트 감지 지점 (2곳, 교체 대상):**

| 위치                                      | 현재 방식                         | 문제                                            |
| ----------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `index.ts:47-49` (`tool.execute.before`)  | `session.agent` 이름 매칭         | Session 타입에 `agent` 없음, 이름 하드코딩      |
| `index.ts:100-101` (`messages.transform`) | `(lastUserMsg.info as any).agent` | 타입 안전성 없음, `client.session.get()` 미호출 |

**`subagentTurnEnd` 참조 맵 (제거 대상, 11개 지점):**

| 파일                  | 라인                                          | 참조 유형             |
| --------------------- | --------------------------------------------- | --------------------- |
| `types.ts:5`          | `subagentTurnEnd?: string`                    | 타입 정의             |
| `constants.ts:6`      | `subagentTurnEndFile: 'subagent-turn-end.md'` | 상수 정의             |
| `config.ts:12`        | `getDefaultConfig()` 내 기본값                | 기본 설정             |
| `config.ts:33`        | `mergeWithDefaults()` 내 병합                 | 설정 병합             |
| `scaffold.ts:14`      | DEFAULT_CONFIG 문자열 리터럴 내 JSON 키       | 스캐폴드 (⚠️ 문자열!) |
| `scaffold.ts:173-179` | `DEFAULT_SUBAGENT_TURN_END` 상수              | 기본 콘텐츠           |
| `scaffold.ts:426-430` | `scaffoldIfNeeded()` writeFileSync            | 파일 생성             |
| `scaffold.ts:457`     | `updateScaffold()` templates 맵               | 업데이트 대상         |
| `scaffold.ts:534`     | `updatePrompts()` prompts 맵                  | 프롬프트 업데이트     |
| `index.ts:106-107`    | turn-end 경로 분기                            | 런타임 분기           |

**테스트 영향:**

- `scaffold.test.ts:175,184` — `toHaveLength(13)` → 12로 변경
- `scaffold.test.ts:380` — `updatePrompts` `toHaveLength(3)` → 2로 변경
- `index.test.ts` — `createMockInput`에 `client.session` mock 부재 → 추가 필수

### Metis Review

**반영한 갭:**

- `createMockInput`에 `client.session.get` mock 추가 (기존 테스트 깨짐 방지)
- `DEFAULT_CONFIG` 문자열 리터럴 내 `subagentTurnEnd` 라인 제거 (코드 참조와 별개)
- `filterByAgentType` 정규식에 non-greedy 매칭 필수 (중첩 방지)
- `isSubagentSession` session.get() 실패 시 false 반환 (fail-open)
- 캐시를 `tool.execute.before`와 `messages.transform` 양쪽에서 공유
- 닫히지 않은 마커 → 무시(pass-through), 크래시 금지

**기각한 제안:**

- Agent.mode 필드 사용 → 범위 밖, parentID만으로 충분
- 기존 subagent-turn-end.md 파일 삭제 마이그레이션 → 범위 밖 (잔존해도 무해)
- 캐시 TTL/LRU → 불필요 (플러그인 인스턴스와 수명 동일)

---

## Work Objectives

### Core Objective

서브에이전트가 메인 에이전트 전용 위임 지시를 받지 않도록 이중 방어 계층을 구현한다:

1. **프롬프트 레벨**: D8 마커로 에이전트 유형별 콘텐츠 필터링
2. **감지 레벨**: Session.parentID 기반 구조적 서브에이전트 식별

### Concrete Deliverables

- `src/lib/prompt-filter.ts` + `prompt-filter.test.ts` — filterByAgentType 유틸리티
- `src/lib/subagent-detector.ts` + `subagent-detector.test.ts` — isSubagentSession 유틸리티
- `src/index.ts` — 두 유틸리티 통합, 이름 기반 감지 제거
- `src/lib/scaffold.ts` — D8 마커 적용 템플릿, subagent-turn-end 제거
- `src/types.ts`, `src/constants.ts`, `src/lib/config.ts` — subagentTurnEnd 참조 제거

### Definition of Done

- [ ] `bun test` — 전체 테스트 통과 (기존 + 신규)
- [ ] `mise run lint` — 린트 에러 0
- [ ] `mise run build` — 빌드 성공
- [ ] Primary 에이전트 mock → turn-start에 위임 지시 포함, turn-end에 체크리스트 포함
- [ ] Subagent mock → turn-start에 위임 지시 미포함, turn-end에 environment-constraints 포함
- [ ] `grep -r "subagentTurnEnd" src/` — 결과 없음
- [ ] `grep -r "subagentTurnEndFile" src/` — 결과 없음
- [ ] `grep -r "DEFAULT_SUBAGENT_TURN_END" src/` — 결과 없음

### Must Have

- D8 마커 구문: `<!-- primary-only -->` / `<!-- /primary-only -->`, `<!-- subagent-only -->` / `<!-- /subagent-only -->`
- filterByAgentType: 마커 없는 콘텐츠 → 원본 그대로 반환 (pass-through)
- isSubagentSession: `!!session?.parentID` 기반 감지, `Map<string, boolean>` 캐시
- 캐시는 `tool.execute.before`와 `messages.transform` 양쪽에서 공유
- session.get() 실패 시 false 반환 (fail-open, primary로 간주)
- Primary 에이전트가 받는 콘텐츠는 현재와 의미적으로 동일 (마커 태그만 제거된 상태)
- 서브에이전트 turn-end에 기존 `<environment-constraints>` 콘텐츠 보존

### Must NOT Have (Guardrails)

- ❌ Agent.mode 필드 사용 금지 — parentID만으로 감지
- ❌ 하드코딩된 에이전트 이름 리스트를 fallback으로 남기지 말 것
- ❌ greedy 정규식 매칭 (`[\s\S]*`) 사용 금지 — non-greedy (`[\s\S]*?`) 필수
- ❌ 캐시에 TTL/LRU/WeakRef 도입 금지 — 단순 Map만
- ❌ knowledge-index.ts, prompt-reader.ts, CLI 시스템 변경 금지
- ❌ turn-start/turn-end 텍스트 내용 리팩토링 금지 (마커 추가만 허용)
- ❌ config.ts의 `DEFAULTS.knowledgeDir` 버그 수정 금지 (별도 이슈)
- ❌ console.log 사용 금지 (ESLint `no-console` 적용)
- ❌ `src/index.ts`에서 named export 금지 (`export default plugin`만 허용)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (vitest, describe/it blocks, tmpdir-based isolation)
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: vitest (`bun test`)
- **Each task follows**: 테스트 먼저 작성 → 구현 → 리팩토링

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Utility modules**: Use Bash (`bun test {file}`) — 단위 테스트 실행 + 결과 캡처
- **Integration**: Use Bash (`bun test`) — 전체 테스트 스위트 실행
- **Build verification**: Use Bash (`mise run build && mise run lint`) — 빌드/린트 통과

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation utilities + cleanup, 4 parallel):
├── Task 1: filterByAgentType 유틸리티 + TDD [quick]
├── Task 2: isSubagentSession 유틸리티 + TDD [quick]
├── Task 3: subagentTurnEnd 타입/설정/상수 제거 [quick]
└── Task 4: D8 마커 적용 기본 템플릿 콘텐츠 [unspecified-low]

Wave 2 (After Wave 1 — integration + scaffold cleanup, 3 parallel):
├── Task 5: scaffold 함수 정리 + 테스트 업데이트 (depends: 3, 4) [quick]
├── Task 6: index.ts 통합 리팩토링 + 테스트 (depends: 1, 2, 3) [deep]
└── Task 7: 지식 노트 업데이트 (depends: none) [writing]

Wave 3 (After Wave 2 — verification):
└── Task 8: 전체 빌드/테스트/린트 검증 (depends: 5, 6) [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real QA [unspecified-high]
└── F4: Scope fidelity check [deep]

Critical Path: Task 1 → Task 6 → Task 8 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
| ---- | ---------- | ------ | ---- |
| 1    | —          | 6      | 1    |
| 2    | —          | 6      | 1    |
| 3    | —          | 5, 6   | 1    |
| 4    | —          | 5      | 1    |
| 5    | 3, 4       | 8      | 2    |
| 6    | 1, 2, 3    | 8      | 2    |
| 7    | —          | —      | 2    |
| 8    | 5, 6       | F1-F4  | 3    |

### Agent Dispatch Summary

| Wave  | Tasks | Categories                                                                   |
| ----- | ----- | ---------------------------------------------------------------------------- |
| 1     | 4     | T1 → `quick`, T2 → `quick`, T3 → `quick`, T4 → `unspecified-low`             |
| 2     | 3     | T5 → `quick`, T6 → `deep`, T7 → `writing`                                    |
| 3     | 1     | T8 → `quick`                                                                 |
| FINAL | 4     | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> TDD: 테스트 먼저 작성 (RED) → 구현 (GREEN) → 리팩토링 (REFACTOR)

- [ ] 1. filterByAgentType 유틸리티 (TDD)

  **What to do**:
  - **RED** (테스트 먼저): `src/lib/prompt-filter.test.ts` 작성
    - 마커 없는 콘텐츠 + isSubagent=false → 원본 반환
    - 마커 없는 콘텐츠 + isSubagent=true → 원본 반환
    - `<!-- primary-only -->` 블록 + isSubagent=false → 마커 태그만 제거, 콘텐츠 보존
    - `<!-- primary-only -->` 블록 + isSubagent=true → 블록 전체(마커+콘텐츠) 제거
    - `<!-- subagent-only -->` 블록 + isSubagent=false → 블록 전체 제거
    - `<!-- subagent-only -->` 블록 + isSubagent=true → 마커 태그만 제거, 콘텐츠 보존
    - 혼합 마커 (primary-only + subagent-only 둘 다) → 각 유형별 정확한 필터링
    - 빈 문자열 입력 → 빈 문자열 반환
    - 마커 사이에 여러 줄(10줄+) 콘텐츠 → 전체 블록 처리
    - 같은 유형 마커 여러 개 → 각각 독립 처리
    - 닫히지 않은 마커 → 크래시 없이 원본 유지 (pass-through)
  - **GREEN** (구현): `src/lib/prompt-filter.ts` 작성
    - `export function filterByAgentType(content: string, isSubagent: boolean): string`
    - isSubagent=true: `<!-- primary-only -->[\s\S]*?<!-- \/primary-only -->` 제거, subagent-only 마커만 벗김
    - isSubagent=false: `<!-- subagent-only -->[\s\S]*?<!-- \/subagent-only -->` 제거, primary-only 마커만 벗김
    - 마커 제거 시 마커 줄의 trailing `\n` 도 함께 제거 (빈 줄 잔존 방지)
    - non-greedy `*?` 필수 (greedy 매칭 금지)
  - **REFACTOR**: 불필요한 중복 제거, 변수명 명확화

  **Must NOT do**:
  - greedy 정규식 (`[\s\S]*`) 사용 금지
  - DOM/AST 파싱 도입 금지 — 정규식으로 충분
  - 마커 밖 콘텐츠 변경 금지 (공백/개행 정규화 포함)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 순수 함수 유틸리티, 외부 의존성 없음, 단일 파일 구현+테스트
  - **Skills**: []
    - 프로젝트 특화 스킬 불필요, 표준 TypeScript/vitest 지식으로 충분

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Task 6 (index.ts integration에서 import)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/lib/prompt-reader.ts:4-14` — 단순 유틸리티 함수 패턴 (export function, try-catch, 단일 책임)

  **Test References**:
  - `src/lib/prompt-reader.test.ts:1-57` — vitest describe/it/expect 구조, tmpdir 불필요 (순수 함수), 엣지 케이스 커버리지

  **External References**:
  - D8 마커 구문 스펙: `<!-- primary-only -->` ... `<!-- /primary-only -->`, `<!-- subagent-only -->` ... `<!-- /subagent-only -->`

  **WHY Each Reference Matters**:
  - prompt-reader.ts: 이 프로젝트의 유틸리티 파일 패턴 (export 방식, 에러 핸들링)을 복제
  - prompt-reader.test.ts: 이 프로젝트의 테스트 스타일 (import 구조, assertion 패턴)을 복제

  **Acceptance Criteria**:
  - [ ] `src/lib/prompt-filter.ts` 생성됨
  - [ ] `src/lib/prompt-filter.test.ts` 생성됨, 11개 이상 테스트 케이스
  - [ ] `bun test src/lib/prompt-filter.test.ts` → ALL PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Happy path — 혼합 마커 콘텐츠 필터링
    Tool: Bash (bun test)
    Preconditions: prompt-filter.ts, prompt-filter.test.ts 존재
    Steps:
      1. bun test src/lib/prompt-filter.test.ts 실행
      2. 출력에서 'Tests' 라인 확인
    Expected Result: 11+ tests, 0 failures
    Failure Indicators: 'FAIL' 키워드, exit code != 0
    Evidence: .sisyphus/evidence/task-1-filter-tests.txt

  Scenario: Edge case — 닫히지 않은 마커 처리
    Tool: Bash (bun test)
    Preconditions: 테스트에 unclosed marker 케이스 포함
    Steps:
      1. bun test src/lib/prompt-filter.test.ts -t 'unclosed' 실행
    Expected Result: PASS — 원본 그대로 반환, 크래시 없음
    Failure Indicators: Error/throw, 콘텐츠 손실
    Evidence: .sisyphus/evidence/task-1-filter-unclosed.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3, 4 — Wave 1 commit)
  - Message: `feat(lib): add prompt filter and subagent detector utilities`
  - Files: `src/lib/prompt-filter.ts`, `src/lib/prompt-filter.test.ts`
  - Pre-commit: `bun test src/lib/prompt-filter.test.ts`

- [ ] 2. isSubagentSession 유틸리티 (TDD)

  **What to do**:
  - **RED** (테스트 먼저): `src/lib/subagent-detector.test.ts` 작성
    - parentID가 있는 세션 → true 반환
    - parentID가 없는 세션 (undefined) → false 반환
    - session.get()이 undefined 반환 → false 반환
    - session.get()이 throw → false 반환 (에러 삼킴, fail-open)
    - 같은 sessionID 두 번 호출 → 두 번째는 캐시 히트 (getSession 1회만 호출됨을 vi.fn()으로 검증)
    - 다른 sessionID → 각각 별도 fetch + 캐시
    - 빈 문자열 sessionID → false 반환 (크래시 없음)
  - **GREEN** (구현): `src/lib/subagent-detector.ts` 작성
    - 함수 시그니처:
      ```typescript
      export async function isSubagentSession(
        getSession: (id: string) => Promise<{ parentID?: string } | undefined>,
        sessionID: string,
        cache: Map<string, boolean>
      ): Promise<boolean>;
      ```
    - 캐시 확인: `cache.has(sessionID)` → `cache.get(sessionID)!` 반환
    - 캐시 미스: `getSession(sessionID)` 호출 → `!!session?.parentID` 계산 → 캐시 저장 → 반환
    - try-catch: 에러 발생 시 `false` 반환 (fail-open, primary로 간주)
  - **REFACTOR**: 불필요한 중복 제거

  **Must NOT do**:
  - Agent.mode 필드 사용 금지
  - `@opencode-ai/plugin` 타입 직접 import 금지 — 제네릭 함수 타입 파라미터 사용
  - 캐시에 TTL/LRU/WeakRef 도입 금지 — 단순 `Map<string, boolean>` 파라미터
  - 하드코딩된 에이전트 이름 리스트 fallback 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 async 유틸리티, 외부 의존성 없음 (getSession은 주입), 단일 파일 구현+테스트
  - **Skills**: []
    - 프로젝트 특화 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 6 (index.ts integration에서 import)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/lib/prompt-reader.ts:4-14` — 유틸리티 함수 패턴 (try-catch + 안전한 기본값 반환)
  - `src/index.ts:42-68` — 현재 tool.execute.before 훅의 session.get() 호출 패턴 (교체 대상이지만 API 사용법 참고)

  **API/Type References**:
  - SDK Session 타입: `{ id: string; parentID?: string; ... }` — parentID 존재 여부로 서브에이전트 판별
  - SDK client.session.get(): `client.session.get({ path: { id: sessionID } })` → `Promise<Session>`

  **Test References**:
  - `src/lib/prompt-reader.test.ts:1-57` — vitest 테스트 구조
  - `src/index.test.ts:10-19` — mock 함수 패턴 (vi.fn() 사용 예정)

  **WHY Each Reference Matters**:
  - index.ts:42-68: `client.session.get()` API 호출 패턴 (path 구조 참고)
  - prompt-reader.ts: 안전한 기본값 반환 패턴 (`catch { return '' }`) → 여기서는 `catch { return false }`

  **Acceptance Criteria**:
  - [ ] `src/lib/subagent-detector.ts` 생성됨
  - [ ] `src/lib/subagent-detector.test.ts` 생성됨, 7개 이상 테스트 케이스
  - [ ] `bun test src/lib/subagent-detector.test.ts` → ALL PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Happy path — parentID 기반 서브에이전트 감지
    Tool: Bash (bun test)
    Preconditions: subagent-detector.ts, subagent-detector.test.ts 존재
    Steps:
      1. bun test src/lib/subagent-detector.test.ts 실행
      2. 출력에서 'Tests' 라인 확인
    Expected Result: 7+ tests, 0 failures
    Failure Indicators: 'FAIL' 키워드, exit code != 0
    Evidence: .sisyphus/evidence/task-2-detector-tests.txt

  Scenario: Edge case — session.get() 실패 시 fail-open
    Tool: Bash (bun test)
    Preconditions: 테스트에 throw 케이스 포함
    Steps:
      1. bun test src/lib/subagent-detector.test.ts -t 'throw' 실행
    Expected Result: PASS — false 반환, 에러 전파 없음
    Failure Indicators: unhandled rejection, 에러 전파
    Evidence: .sisyphus/evidence/task-2-detector-failopen.txt
  ```

  **Commit**: YES (groups with Tasks 1, 3, 4 — Wave 1 commit)
  - Message: `feat(lib): add prompt filter and subagent detector utilities`
  - Files: `src/lib/subagent-detector.ts`, `src/lib/subagent-detector.test.ts`
  - Pre-commit: `bun test src/lib/subagent-detector.test.ts`

- [ ] 3. subagentTurnEnd 타입/설정/상수 제거

  **What to do**:
  - **RED**: Update `src/lib/config.test.ts` — add assertion that `config.prompts` does NOT contain `subagentTurnEnd` key
  - **GREEN**: Remove from 3 files:
    - `src/types.ts:5` — remove `subagentTurnEnd?: string;` line
    - `src/constants.ts:6` — remove `subagentTurnEndFile: 'subagent-turn-end.md',` line
    - `src/lib/config.ts:12` — remove `subagentTurnEnd: join(...)` from getDefaultConfig()
    - `src/lib/config.ts:33` — remove `subagentTurnEnd: partial.prompts?.subagentTurnEnd ?? ...` from mergeWithDefaults()
  - **REFACTOR**: Fix trailing commas if needed

  **Must NOT do**:
  - scaffold.ts 수정 금지 (Tasks 4, 5에서 처리)
  - index.ts 수정 금지 (Task 6에서 처리)
  - config.ts의 `DEFAULTS.knowledgeDir` 버그 수정 금지 (별도 이슈)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 4개 파일에서 각 1-2줄 제거, 단순 삭제 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 6 (타입 제거가 선행되어야 훅/스캐폴드 정리 가능)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/types.ts:1-17` — ContextConfig 인터페이스 전체 (line 5의 subagentTurnEnd 제거 대상)
  - `src/constants.ts:1-12` — DEFAULTS 객체 전체 (line 6의 subagentTurnEndFile 제거 대상)
  - `src/lib/config.ts:7-47` — getDefaultConfig() + mergeWithDefaults() (lines 12, 33 제거 대상)

  **Test References**:
  - `src/lib/config.test.ts:19-29` — 기본 설정 테스트 (subagentTurnEnd 부재 assertion 추가 필요)
  - `src/lib/config.test.ts:92-114` — 부분 설정 병합 테스트

  **WHY Each Reference Matters**:
  - types.ts: ContextConfig.prompts의 subagentTurnEnd 필드 제거 → config.ts의 타입 에러 발생 → config.ts 수정 트리거
  - constants.ts: DEFAULTS.subagentTurnEndFile 제거 → config.ts/scaffold.ts에서 참조 끊김
  - config.test.ts: 제거 후에도 기존 테스트가 모두 통과해야 함을 증명

  **Acceptance Criteria**:
  - [ ] `src/types.ts` — `subagentTurnEnd` 필드 없음
  - [ ] `src/constants.ts` — `subagentTurnEndFile` 필드 없음
  - [ ] `src/lib/config.ts` — `subagentTurnEnd` 문자열 없음
  - [ ] `bun test src/lib/config.test.ts` → ALL PASS
  - [ ] `grep -r 'subagentTurnEnd' src/types.ts src/constants.ts src/lib/config.ts` → 결과 없음

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Happy path — subagentTurnEnd 제거 후 config 테스트 통과
    Tool: Bash (bun test)
    Preconditions: types.ts, constants.ts, config.ts 수정 완료
    Steps:
      1. bun test src/lib/config.test.ts 실행
      2. 모든 테스트 통과 확인
    Expected Result: ALL PASS, 기존 테스트 + 신규 assertion 모두 성공
    Failure Indicators: 'FAIL', TypeScript 타입 에러
    Evidence: .sisyphus/evidence/task-3-config-tests.txt

  Scenario: Negative — subagentTurnEnd 참조 완전 제거 확인
    Tool: Bash (grep)
    Steps:
      1. grep -r 'subagentTurnEnd' src/types.ts src/constants.ts src/lib/config.ts
    Expected Result: exit code 1 (결과 없음)
    Failure Indicators: 문자열 발견됨
    Evidence: .sisyphus/evidence/task-3-grep-cleanup.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2, 4 — Wave 1 commit)
  - Message: `feat(lib): add prompt filter and subagent detector utilities`
  - Files: `src/types.ts`, `src/constants.ts`, `src/lib/config.ts`, `src/lib/config.test.ts`
  - Pre-commit: `bun test src/lib/config.test.ts`

- [ ] 4. D8 마커 적용 기본 템플릿 콘텐츠

  **What to do**:
  - `src/lib/scaffold.ts`의 템플릿 상수만 수정 (함수 수정 없음)
  - **DEFAULT_TURN_START** 수정:
    - Line 39 (`서브에이전트(explore)에 위임` 불릿) → `<!-- primary-only -->` ... `<!-- /primary-only -->`로 감싸기
    - Line 39 하단에 `<!-- subagent-only -->` 블록 추가: "관련 문서를 직접 읽고 작업에 적용하세요. 서브에이전트를 호출하지 마세요."
    - Lines 44-78 (`### 지식 탐색 (서브에이전트 위임)` 섹션 전체 — task() 코드 블록 + 중복 불릿 포함) → `<!-- primary-only -->` ... `<!-- /primary-only -->`로 감싸기
    - Line 90 (`새로운 결정은 서브에이전트에 위임하여 기록` 불릿) → `<!-- primary-only -->` ... `<!-- /primary-only -->`로 감싸기
  - **DEFAULT_TURN_END** 수정:
    - 기존 전체 콘텐츠 (마무리 체크리스트 + 지식 정리) → `<!-- primary-only -->` ... `<!-- /primary-only -->`로 감싸기
    - 하단에 `<!-- subagent-only -->` 블록 추가: 기존 DEFAULT_SUBAGENT_TURN_END의 `<environment-constraints>` 콘텐츠 포함
  - **DEFAULT_SUBAGENT_TURN_END** 상수 제거 (line 173-179)
  - ⚠️ 중요: 마커 이외의 텍스트 내용은 절대 변경하지 말 것

  **Must NOT do**:
  - 텍스트 내용 리팩토링 금지 (마커 삽입만 허용)
  - scaffold.ts 함수 수정 금지 (scaffoldIfNeeded, updateScaffold, updatePrompts → Task 5)
  - DEFAULT_CONFIG 문자열 수정 금지 (→ Task 5)
  - TEMPLATE_FILES 레코드 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 템플릿 문자열 내 정확한 위치에 마커 삽입 필요, 한글 콘텐츠 이해 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 5 (scaffold 함수에서 업데이트된 템플릿 참조)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:25-91` — DEFAULT_TURN_START 전체 콘텐츠 (마커 삽입 위치 확인)
  - `src/lib/scaffold.ts:93-171` — DEFAULT_TURN_END 전체 콘텐츠 (전체를 primary-only로 감싸기)
  - `src/lib/scaffold.ts:173-179` — DEFAULT_SUBAGENT_TURN_END (제거 대상, 콘텐츠는 turn-end 내 subagent-only 블록으로 이동)

  **External References**:
  - D8 마커 구문: `<!-- primary-only -->` ... `<!-- /primary-only -->`, `<!-- subagent-only -->` ... `<!-- /subagent-only -->`

  **WHY Each Reference Matters**:
  - scaffold.ts:25-91: 마커를 정확한 위치에 삽입해야 함 — 잘못된 위치는 의도와 다른 필터링 초래
  - scaffold.ts:173-179: 이 콘텐츠를 turn-end의 subagent-only 블록으로 이동해야 함

  **Acceptance Criteria**:
  - [ ] DEFAULT_TURN_START에 `<!-- primary-only -->` 3개 블록 + `<!-- subagent-only -->` 1개 블록 존재
  - [ ] DEFAULT_TURN_END에 `<!-- primary-only -->` 1개 블록 + `<!-- subagent-only -->` 1개 블록 존재
  - [ ] DEFAULT_SUBAGENT_TURN_END 상수가 scaffold.ts에서 제거됨
  - [ ] `grep 'DEFAULT_SUBAGENT_TURN_END' src/lib/scaffold.ts` → 결과 없음
  - [ ] 마커 이외의 텍스트 콘텐츠가 변경되지 않았음 (기존 내용 보존)
  - [ ] `mise run build` → 빌드 성공

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Happy path — D8 마커 존재 확인
    Tool: Bash (grep)
    Steps:
      1. grep -c 'primary-only' src/lib/scaffold.ts
      2. grep -c 'subagent-only' src/lib/scaffold.ts
      3. grep -c 'DEFAULT_SUBAGENT_TURN_END' src/lib/scaffold.ts
    Expected Result: primary-only 출현 8회(4개 열림+4개 닫힘), subagent-only 출현 4회(2개 열림+2개 닫힘), DEFAULT_SUBAGENT_TURN_END 출현 0회
    Failure Indicators: 카운트 불일치
    Evidence: .sisyphus/evidence/task-4-marker-grep.txt

  Scenario: Negative — 텍스트 내용 보존 확인
    Tool: Bash (grep)
    Steps:
      1. grep '제텔카스텐' src/lib/scaffold.ts (존재 확인)
      2. grep 'environment-constraints' src/lib/scaffold.ts (존재 확인)
      3. grep '작업 마무리' src/lib/scaffold.ts (존재 확인)
    Expected Result: 모두 존재 (기존 콘텐츠 보존됨)
    Failure Indicators: 어떤 grep도 결과 없음
    Evidence: .sisyphus/evidence/task-4-content-preserved.txt
  ```

  **Commit**: YES (groups with Tasks 1, 2, 3 — Wave 1 commit)
  - Message: `feat(lib): add prompt filter and subagent detector utilities`
  - Files: `src/lib/scaffold.ts` (템플릿 상수 마커 추가 + DEFAULT_SUBAGENT_TURN_END 제거)
  - Pre-commit: `mise run build` (타입 체크)

- [ ] 5. scaffold 함수 정리 + 테스트 업데이트

  **What to do**:
  - **RED**: Update `src/lib/scaffold.test.ts`:
    - Line 175: `toHaveLength(13)` → `toHaveLength(12)` (updateScaffold creates missing files)
    - Line 184: `toHaveLength(13)` → `toHaveLength(12)` (updateScaffold creates scaffold)
    - Line 380: `toHaveLength(3)` → `toHaveLength(2)` (updatePrompts creates prompt files)
  - **GREEN**: Modify `src/lib/scaffold.ts` functions:
    - `scaffoldIfNeeded()` (line 426-430): Remove the writeFileSync call for subagent-turn-end.md (4줄 제거)
    - `updateScaffold()` (line 457): Remove `[prompts/${DEFAULTS.subagentTurnEndFile}]: DEFAULT_SUBAGENT_TURN_END` entry
    - `updatePrompts()` (line 534): Remove `[prompts/${DEFAULTS.subagentTurnEndFile}]: DEFAULT_SUBAGENT_TURN_END` entry
    - `DEFAULT_CONFIG` string literal (line 14): Remove the `"subagentTurnEnd": "..."` JSON line
  - **REFACTOR**: Clean up trailing commas in DEFAULT_CONFIG string

  **Must NOT do**:
  - 템플릿 상수 수정 금지 (Task 4에서 완료됨)
  - index.ts 수정 금지 (Task 6에서 처리)
  - 기존 사용자의 subagent-turn-end.md 파일 삭제 금지 (무해한 잔존 파일)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 함수 내 특정 라인 제거 + 테스트 숫자 변경, 단순 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Task 8 (전체 검증)
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:8-23` — DEFAULT_CONFIG 문자열 리터럴 (⚠️ line 14: `"subagentTurnEnd"` JSON 키 제거)
  - `src/lib/scaffold.ts:408-442` — scaffoldIfNeeded() (lines 426-430: subagent-turn-end.md writeFileSync 제거)
  - `src/lib/scaffold.ts:444-475` — updateScaffold() (line 457: subagentTurnEndFile 엔트리 제거)
  - `src/lib/scaffold.ts:527-550` — updatePrompts() (line 534: subagentTurnEndFile 엔트리 제거)

  **Test References**:
  - `src/lib/scaffold.test.ts:175` — `toHaveLength(13)` → 12 (updateScaffold missing files)
  - `src/lib/scaffold.test.ts:184` — `toHaveLength(13)` → 12 (updateScaffold creates scaffold)
  - `src/lib/scaffold.test.ts:380` — `toHaveLength(3)` → 2 (updatePrompts creates prompts)

  **WHY Each Reference Matters**:
  - scaffold.ts:8-23: DEFAULT_CONFIG는 코드가 아닌 문자열 리터럴이므로 grep으로 놓치기 쉬움
  - scaffold.ts:426-430: scaffoldIfNeeded에서 subagent-turn-end.md 생성 로직의 정확한 제거 위치
  - scaffold.test.ts:175,184: 파일 수 기대값을 정확히 12로 변경해야 테스트 통과

  **Acceptance Criteria**:
  - [ ] DEFAULT_CONFIG 문자열에 `subagentTurnEnd` 없음
  - [ ] scaffoldIfNeeded()에서 subagent-turn-end.md 생성 코드 없음
  - [ ] updateScaffold(), updatePrompts()에서 subagentTurnEndFile 참조 없음
  - [ ] `bun test src/lib/scaffold.test.ts` → ALL PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Happy path — scaffold 테스트 통과
    Tool: Bash (bun test)
    Steps:
      1. bun test src/lib/scaffold.test.ts 실행
    Expected Result: ALL PASS
    Failure Indicators: 'FAIL', toHaveLength 불일치
    Evidence: .sisyphus/evidence/task-5-scaffold-tests.txt

  Scenario: Negative — 함수/설정에서 subagentTurnEnd 제거 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n 'subagentTurnEnd' src/lib/scaffold.ts | grep -v 'primary-only\|subagent-only'
    Expected Result: 결과 없음 (템플릿 마커 내 텍스트는 제외하고 함수/설정에서 제거됨)
    Evidence: .sisyphus/evidence/task-5-scaffold-grep.txt
  ```

  **Commit**: YES (groups with Tasks 6, 7 — Wave 2 commit)
  - Message: `refactor: replace name-based subagent detection with parentID + D8 marker filtering`
  - Files: `src/lib/scaffold.ts` (functions + DEFAULT_CONFIG), `src/lib/scaffold.test.ts`
  - Pre-commit: `bun test src/lib/scaffold.test.ts`

- [ ] 6. index.ts 통합 리팩토링 + 테스트

  This is the **MOST COMPLEX** task. Read all references carefully.

  **What to do**:
  - **RED**: Update `src/index.test.ts`:
    - Update `createMockInput` (line 10-19) to include `client.session` mock:
      ```typescript
      client: {
        app: { log: () => Promise.resolve() },
        session: {
          get: () => Promise.resolve({ parentID: undefined }), // default: primary agent
        },
      }
      ```
    - Add new test: "filters turn-start content for subagent" — mock session.get to return `{ parentID: 'parent-1' }`, verify turn-start part does NOT contain delegation text (e.g., "서브에이전트에 위임")
    - Add new test: "keeps turn-start delegation content for primary agent" — verify primary gets full content including delegation text
    - Add new test: "injects subagent turn-end with environment-constraints" — mock as subagent, verify turn-end contains `<environment-constraints>`
    - Add new test: "injects primary turn-end with quality checklist" — verify primary gets content with "작업 마무리"
    - Verify ALL 12 existing tests still pass with updated mock
  - **GREEN**: Refactor `src/index.ts`:
    1. Add imports at top:
       ```typescript
       import { filterByAgentType } from './lib/prompt-filter.js';
       import { isSubagentSession } from './lib/subagent-detector.js';
       ```
    2. Inside plugin closure (after `const config = loadConfig(directory);` line 39), add:
       ```typescript
       const subagentCache = new Map<string, boolean>();
       const getSession = (id: string) => client.session.get({ path: { id } });
       ```
    3. In `tool.execute.before` hook (lines 42-68):
       - Replace lines 44-49 with:
         ```typescript
         const isSubagent = await isSubagentSession(getSession, input.sessionID, subagentCache);
         ```
       - Remove `session.agent` reference and name-based detection
    4. In `messages.transform` hook (lines 69-135):
       - After `const turnStart = readPromptFile(turnStartPath);` (line 80), add:
         ```typescript
         const sessionID = lastUserMsg.info.sessionID;
         const isSubagent = await isSubagentSession(getSession, sessionID, subagentCache);
         const filteredTurnStart = filterByAgentType(turnStart, isSubagent);
         ```
       - Change `const combinedContent = [turnStart, indexContent]` to use `filteredTurnStart`
       - Remove lines 100-101 (agentName/isSubagent old detection)
       - Replace lines 103-109 (turn-end path branching) with single path:
         ```typescript
         const turnEndPath = join(
           directory,
           config.prompts.turnEnd ?? join(DEFAULTS.promptDir, DEFAULTS.turnEndFile)
         );
         ```
       - After `const turnEnd = readPromptFile(turnEndPath);`, add:
         ```typescript
         const filteredTurnEnd = filterByAgentType(turnEnd, isSubagent);
         ```
       - Use `filteredTurnEnd` in message injection (line 131) instead of `turnEnd`
  - **REFACTOR**: Remove unused `as any` casts for agent name access

  **Must NOT do**:
  - scaffold.ts, types.ts, constants.ts, config.ts 수정 금지 (이미 완료)
  - Agent.mode 감지 추가 금지
  - 하드코딩된 에이전트 이름 리스트를 fallback으로 남기지 말 것
  - console.log 사용 금지 (필요시 client.app.log 사용)
  - index.ts에서 named export 추가 금지 (`export default plugin`만 허용)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 가장 복잡한 태스크 — 2개 훅 동시 리팩토링, mock 업데이트, 기존 12개 테스트 호환성 유지 + 4개 신규 테스트
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Task 8 (전체 검증)
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `src/index.ts:1-139` — 전체 파일 (다중 수정 지점)
  - `src/index.ts:42-68` — tool.execute.before 훅 (lines 47-49 교체: 이름 매칭 → parentID)
  - `src/index.ts:69-135` — messages.transform 훅 (lines 100-109 교체: 감지+분기 → 필터링)

  **API/Type References**:
  - `src/lib/prompt-filter.ts` — filterByAgentType(content: string, isSubagent: boolean): string (Task 1에서 생성)
  - `src/lib/subagent-detector.ts` — isSubagentSession(getSession, sessionID, cache): Promise<boolean> (Task 2에서 생성)

  **Test References**:
  - `src/index.test.ts:10-19` — createMockInput (client.session mock 추가 필수)
  - `src/index.test.ts:44-72` — 기존 turn-start 테스트 (업데이트된 mock으로도 통과해야 함)
  - `src/index.test.ts:205-237` — 기존 turn-end 테스트 (업데이트된 mock으로도 통과해야 함)

  **WHY Each Reference Matters**:
  - index.ts:42-68: tool.execute.before에서 session.get() 호출은 이미 존재, 감지 로직만 교체
  - index.ts:100-101: `(lastUserMsg.info as any).agent` 제거 → 타입 안전성 개선
  - index.test.ts:10-19: createMockInput에 client.session 누락 → 추가 없이 transform 호출 시 TypeError

  **Acceptance Criteria**:
  - [ ] `grep 'explore.*librarian.*oracle' src/index.ts` → 결과 없음 (이름 리스트 제거)
  - [ ] `grep 'subagentTurnEnd\|subagent-turn-end' src/index.ts` → 결과 없음
  - [ ] `bun test src/index.test.ts` → ALL PASS (기존 12 + 신규 4 = 16+ 테스트)
  - [ ] `(lastUserMsg.info as any).agent` 패턴 없음
  - [ ] 양쪽 훅이 동일한 `subagentCache` 인스턴스 공유

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Happy path — 전체 index 테스트 통과
    Tool: Bash (bun test)
    Steps:
      1. bun test src/index.test.ts 실행
    Expected Result: 16+ tests, 0 failures
    Failure Indicators: 'FAIL', TypeError (mock 누락)
    Evidence: .sisyphus/evidence/task-6-index-tests.txt

  Scenario: Name-based detection 완전 제거 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n 'explore.*librarian\|Sisyphus-Junior' src/index.ts
      2. grep -n 'subagentTurnEnd' src/index.ts
    Expected Result: 양쪽 모두 결과 없음
    Evidence: .sisyphus/evidence/task-6-name-removal.txt

  Scenario: Primary agent가 위임 지시를 받음
    Tool: Bash (bun test)
    Steps:
      1. bun test src/index.test.ts -t 'primary'
    Expected Result: PASS — primary agent turn-start에 위임 콘텐츠 포함
    Evidence: .sisyphus/evidence/task-6-primary-content.txt

  Scenario: Subagent가 위임 지시를 받지 않음
    Tool: Bash (bun test)
    Steps:
      1. bun test src/index.test.ts -t 'subagent'
    Expected Result: PASS — subagent turn-start에 위임 콘텐츠 미포함
    Evidence: .sisyphus/evidence/task-6-subagent-filtered.txt
  ```

  **Commit**: YES (groups with Tasks 5, 7 — Wave 2 commit)
  - Message: `refactor: replace name-based subagent detection with parentID + D8 marker filtering`
  - Files: `src/index.ts`, `src/index.test.ts`
  - Pre-commit: `bun test src/index.test.ts`

- [ ] 7. 지식 노트 업데이트

  **What to do**:
  - Update `docs/decision-subagent-infinite-loop-prevention.md`:
    - 현재 문서: 이름 기반 감지 + 별도 subagent-turn-end.md 기술
    - 업데이트: D8 마커 필터링 + parentID 기반 감지로 변경
    - "이중 방어" 개념은 유지하되 양쪽 계층 업데이트:
      - 첫 번째 계층: D8 마커 기반 프롬프트 필터링 (별도 subagent-turn-end.md 대신)
      - 두 번째 계층: Session.parentID 기반 구조적 감지 (에이전트 이름 매칭 대신)
    - 관련 wikilink 보존 및 업데이트

  **Must NOT do**:
  - 소스 코드 파일 수정 금지
  - 새 지식 노트 생성 금지 (기존 노트 업데이트만)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 기술 문서 업데이트, 한글 작성, 기존 구조 유지
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Nothing
  - **Blocked By**: None (logically after understanding changes, but no code dependency)

  **References**:

  **Pattern References**:
  - `docs/decision-subagent-infinite-loop-prevention.md` — 현재 결정 문서 (36줄, 업데이트 대상)

  **External References**:
  - `docs/architecture.md` — 아키텍처 개요 (subagent-turn-end.md 언급 여부 확인)

  **WHY Each Reference Matters**:
  - decision doc: 이 문서가 현재 접근법을 기술하고 있으므로 새 접근법 반영 필수

  **Acceptance Criteria**:
  - [ ] 결정 문서에 D8 마커 + parentID 접근법 기술됨
  - [ ] 이름 기반 감지나 하드코딩된 에이전트 이름 언급 없음
  - [ ] Wikilinks 보존 및 업데이트됨

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 결정 문서가 새 접근법 반영
    Tool: Bash (grep)
    Steps:
      1. grep 'parentID' docs/decision-subagent-infinite-loop-prevention.md
      2. grep 'primary-only\|마커\|marker' docs/decision-subagent-infinite-loop-prevention.md
    Expected Result: 양쪽 용어 모두 존재
    Failure Indicators: 어느 쪽이든 결과 없음
    Evidence: .sisyphus/evidence/task-7-doc-update.txt
  ```

  **Commit**: YES (groups with Tasks 5, 6 — Wave 2 commit)
  - Message: `refactor: replace name-based subagent detection with parentID + D8 marker filtering`
  - Files: `docs/decision-subagent-infinite-loop-prevention.md`
  - Pre-commit: none

- [ ] 8. 전체 빌드/테스트/린트 검증

  **What to do**:
  - 전체 검증 스위트 실행:
    1. `bun test` — 모든 테스트 통과 (기존 + 신규, 전체 테스트 파일)
    2. `mise run lint` — 린트 에러 0개
    3. `mise run build` — 빌드 성공
    4. `grep -r "subagentTurnEnd" src/` — 결과 없음 (scaffold.ts 템플릿 마커 내 텍스트 제외)
    5. `grep -r "subagentTurnEndFile" src/` — 결과 없음
    6. `grep -r "DEFAULT_SUBAGENT_TURN_END" src/` — 결과 없음
    7. `grep -r "Sisyphus-Junior" src/` — 결과 없음
  - 실패 시 정확한 에러와 파일 위치 보고

  **Must NOT do**:
  - 이슈 수정 금지 — 보고만 (수정은 담당 태스크로 돌아감)
  - 파일 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 명령어 실행 + 결과 확인만, 코드 변경 없음
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: F1-F4 (Final Verification)
  - **Blocked By**: Tasks 5, 6

  **References**:
  - Tasks 1-7에서 수정된 모든 파일

  **Acceptance Criteria**:
  - [ ] `bun test` — ALL PASS
  - [ ] `mise run lint` — 0 errors
  - [ ] `mise run build` — success
  - [ ] 모든 grep 체크에서 결과 없음

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 전체 검증 통과
    Tool: Bash
    Steps:
      1. bun test
      2. mise run lint
      3. mise run build
      4. grep -r "subagentTurnEnd" src/ (템플릿 마커 내 텍스트 외 0건)
      5. grep -r "Sisyphus-Junior" src/ (0건)
    Expected Result: 모두 통과, grep 모두 clean
    Failure Indicators: 어떤 단계든 실패
    Evidence: .sisyphus/evidence/task-8-full-verification.txt
  ```

  **Commit**: NO (verification only)

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read `.sisyphus/plans/subagent-loop-fix.md` end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [8/8] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `mise run build && mise run lint && bun test`. Review all changed files for: `as any` (minimize), `@ts-ignore` (forbidden), empty catches (only in error-swallow patterns), console.log (forbidden), commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify single quotes, 100 char line width, 2-space indent.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real QA** — `unspecified-high`
      Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: primary agent gets full delegation content, subagent gets restricted content, both hooks share cache, session.get() failure handled gracefully. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff (`git diff`). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Verify these files were NOT modified: `src/lib/knowledge-index.ts`, `src/lib/prompt-reader.ts`, `src/cli/**`. Flag unaccounted changes.
      Output: `Tasks [8/8 compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After  | Message                                                                               | Files                                                                                                                        | Pre-commit                                                                                        |
| ------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Wave 1 | `feat(lib): add prompt filter and subagent detector utilities`                        | prompt-filter.ts/test, subagent-detector.ts/test, types.ts, constants.ts, config.ts, config.test.ts, scaffold.ts (templates) | `bun test src/lib/prompt-filter.test.ts src/lib/subagent-detector.test.ts src/lib/config.test.ts` |
| Wave 2 | `refactor: replace name-based subagent detection with parentID + D8 marker filtering` | index.ts, index.test.ts, scaffold.ts (functions), scaffold.test.ts, docs/decision-\*.md                                      | `bun test`                                                                                        |
| Wave 3 | (no commit — verification only)                                                       | —                                                                                                                            | —                                                                                                 |

---

## Success Criteria

### Verification Commands

```bash
bun test                     # Expected: ALL tests pass (existing + new)
mise run lint                # Expected: 0 errors
mise run build               # Expected: build success
grep -r "subagentTurnEnd" src/           # Expected: no results
grep -r "subagentTurnEndFile" src/       # Expected: no results
grep -r "DEFAULT_SUBAGENT_TURN_END" src/ # Expected: no results
grep -r "Sisyphus-Junior" src/           # Expected: no results
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (bun test)
- [ ] Lint clean (mise run lint)
- [ ] Build succeeds (mise run build)
- [ ] Primary agent receives delegation instructions in turn-start
- [ ] Subagent does NOT receive delegation instructions
- [ ] Subagent receives `<environment-constraints>` in turn-end
- [ ] Session cache shared between both hooks
- [ ] session.get() failure → graceful fallback to primary behavior
