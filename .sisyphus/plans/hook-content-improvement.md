# Hook Content Improvement — 제텔카스텐 가이드 & 노트 템플릿

## TL;DR

> **Quick Summary**: turn-start/turn-end 훅 콘텐츠를 개선하여 구체적인 제텔카스텐 지식관리 가이드를 제공하고, 8가지 노트 템플릿을 scaffold가 **개별 파일로** 자동 생성합니다. turn-end에서 유형별 트리거 조건에 해당 템플릿 파일 링크를 직접 제공하여, 에이전트가 필요한 템플릿만 선택적으로 읽을 수 있습니다.
>
> **Deliverables**:
>
> - 개선된 turn-start 훅 콘텐츠 (제텔카스텐 핵심 원칙 + 지식 읽기 가이드)
> - 개선된 turn-end 훅 콘텐츠 (유형별 트리거 조건 + 개별 템플릿 파일 링크)
> - `.opencode/context/templates/` 디렉토리에 8개 개별 템플릿 파일
> - scaffold 함수 업데이트 (templates 디렉토리 + 8개 파일 자동 생성)
> - 테스트 업데이트
>
> **Estimated Effort**: Short (각 태스크 30분 이내)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Task 3/4/5 → Task 6 → Task 7

---

## Context

### Original Request

사용자가 turn-start/turn-end 훅 콘텐츠를 개선하고 싶어함:

1. 제텔카스텐 기반 지식관리가 무엇인지, 어떻게 하는 것인지에 대한 구체적 가이드 추가
2. 5~10가지 노트 템플릿을 제공하여 상황에 맞게 활용하도록 함
3. 템플릿은 참조 파일로 작성, 훅에서는 참조로 삽입

### Interview Summary

**Key Discussions**:

- 템플릿 배치 위치: `.opencode/context/templates/` (scaffold 자동 생성) 확정
- 템플릿 선택: 전체 8개 채택 (ADR, Pattern, Bug, Gotcha, Decision, Context, Runbook, Insight)
- 훅 가이드 깊이: 핵심 원칙 + 템플릿 참조 방식 (인라인 상세 설명이 아닌 참조)

**Research Findings**:

- AI 에이전트는 세션 간 컨텍스트를 잃음 -> "무엇을 결정했고 왜"가 가장 중요한 지식 유형
- 에이전트는 패턴 완성 기계 -> 명시적 패턴 문서화가 일관성의 핵심
- 같은 버그를 반복 만남 -> 버그+해결 기록의 ROI가 높음
- 플랫 구조 + 시맨틱 네이밍 프리픽스가 AI 에이전트에 최적

### Metis Review

**Identified Gaps** (addressed):

- 템플릿 파일 구성: **8개 개별 파일**로 결정 (에이전트가 필요한 템플릿만 선택적으로 읽음, 토큰 절약)
- 사용자 커스터마이즈 정책: `updateScaffold()`가 콘텐츠 다르면 덮어씀 -> 기존 정책 유지 (문서화)
- constants.ts 업데이트 필요: 템플릿 디렉토리 경로 상수 추가
- 테스트 assertions 업데이트: 3파일->11파일로 변경 (config + 2 prompts + 8 templates)

### User Feedback (Plan Review)

- 템플릿별로 파일 분리 필요
- turn-end에 유형별 트리거 조건에 파일 링크 제공
- 에이전트가 불필요하게 많은 템플릿을 읽지 않아도 되게 할 것

---

## Work Objectives

### Core Objective

turn-start/turn-end 훅 콘텐츠에 구체적인 제텔카스텐 가이드를 추가하고, 8가지 노트 템플릿을 scaffold가 **개별 파일로** 자동 생성하여 AI 에이전트가 필요한 템플릿만 선택적으로 참조할 수 있게 한다.

### Concrete Deliverables

- `src/constants.ts` -- 템플릿 디렉토리 경로 상수 추가
- `src/lib/scaffold.ts` -- DEFAULT_TURN_START, DEFAULT_TURN_END 콘텐츠 개선 + 8개 템플릿 상수 + scaffold 함수 업데이트
- `src/lib/scaffold.test.ts` -- 테스트 업데이트
- `.opencode/context/templates/` -- scaffold가 자동 생성하는 8개 개별 템플릿 파일 (최종 사용자 환경):
  - `adr.md`, `pattern.md`, `bug.md`, `gotcha.md`, `decision.md`, `context.md`, `runbook.md`, `insight.md`

### Definition of Done

- [ ] `bun test` -- 모든 테스트 통과
- [ ] `mise run lint` -- 린트 에러 없음
- [ ] `mise run build` -- 빌드 성공

### Must Have

- turn-start에 제텔카스텐 3대 원칙 (원자성, 연결, 자기 언어) 설명 포함
- turn-end에 8가지 템플릿 유형별 트리거 조건 + 파일명 패턴 + **개별 템플릿 파일 링크** 가이드 포함
- `.opencode/context/templates/`에 8개 개별 템플릿 파일, 각각 해당 유형의 상세 구조 포함
- scaffold 함수가 templates 디렉토리와 8개 파일을 자동 생성
- updateScaffold가 8개 template 파일도 업데이트 대상에 포함
- 기존 turn-end 퀄리티 체크리스트 (lint, 타입, 테스트) 유지
- 한국어 기조 유지

### Must NOT Have (Guardrails)

- knowledge-index.ts 수정 금지 -- 인덱스 빌딩 로직은 이 작업 범위 밖
- config.ts / config 로딩 수정 금지 -- 설정 구조 변경 없음
- system.transform 훅 수정 금지 -- 메시지 훅 콘텐츠만 변경
- 새로운 플러그인 커맨드 추가 금지 -- 기존 context-update만 활용
- 기존 프롬프트 파일 경로 변경 금지 -- turn-start.md, turn-end.md 경로 유지
- 템플릿 유효성 검증 로직 추가 금지 -- 참조 파일일 뿐 스키마 강제 아님
- 템플릿 인덱싱/검색 시스템 추가 금지
- 동적 템플릿 디스커버리 추가 금지
- 다국어(i18n) 인프라 추가 금지
- 과도한 주석/JSDoc/설명 추가 금지 (AI 슬롭 방지)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** -- ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: YES (Tests-after -- 기존 테스트 업데이트)
- **Framework**: vitest (`bun test`)
- 기존 `scaffold.test.ts` 패턴을 따라 테스트 추가/수정

### QA Policy

Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (`bun test`, `bun run build`) -- 테스트 실행, 빌드 확인
- **Code Quality**: Use Bash (`mise run lint`) -- 린트 통과 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation -- independent prep):
+-- Task 1: constants.ts에 템플릿 디렉토리 경로 상수 추가 [quick]
+-- Task 2: 8개 개별 템플릿 콘텐츠 작성 [writing]

Wave 2 (Core content -- depends on Wave 1):
+-- Task 3: DEFAULT_TURN_START 리라이트 [quick]
+-- Task 4: DEFAULT_TURN_END 리라이트 (개별 템플릿 파일 링크 포함) [quick]
+-- Task 5: scaffold 함수 업데이트 (8개 파일 자동 생성) [quick]

Wave 3 (Verification -- depends on Wave 2):
+-- Task 6: scaffold.test.ts 업데이트 [quick]
+-- Task 7: 최종 검증 (lint, typecheck, test, build) [quick]

Wave FINAL (Independent review):
+-- Task F1: Plan compliance audit (oracle)
+-- Task F2: Code quality review (unspecified-high)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave  |
| ---- | ---------- | ------ | ----- |
| 1    | --         | 5      | 1     |
| 2    | --         | 5      | 1     |
| 3    | --         | 6      | 2     |
| 4    | --         | 6      | 2     |
| 5    | 1, 2       | 6      | 2     |
| 6    | 3, 4, 5    | 7      | 3     |
| 7    | 6          | F1, F2 | 3     |
| F1   | 7          | --     | FINAL |
| F2   | 7          | --     | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks -- T1 -> `quick`, T2 -> `writing`
- **Wave 2**: 3 tasks -- T3 -> `quick`, T4 -> `quick`, T5 -> `quick`
- **Wave 3**: 2 tasks -- T6 -> `quick`, T7 -> `quick`
- **FINAL**: 2 tasks -- F1 -> `oracle`, F2 -> `unspecified-high`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [ ] 1. constants.ts에 템플릿 디렉토리 경로 상수 추가

  **What to do**:
  - `DEFAULTS` 객체에 `templateDir` 속성 추가: `'.opencode/context/templates'`
  - 기존 속성(promptDir, turnStartFile, turnEndFile, knowledgeSources, knowledgeDir)은 그대로 유지
  - 개별 템플릿 파일명은 scaffold.ts에서 관리 (constants에는 디렉토리만)

  **Must NOT do**:
  - LIMITS 객체 수정 금지
  - 기존 DEFAULTS 속성값 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일, 1줄 추가의 간단한 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/constants.ts:1-16` -- 현재 DEFAULTS, LIMITS 객체 구조. 동일한 패턴으로 속성 추가

  **API/Type References**:
  - `src/types.ts` -- Config 타입이 있다면 확인

  **WHY Each Reference Matters**:
  - constants.ts: 기존 네이밍 컨벤션(camelCase, as const)을 따라야 함

  **Acceptance Criteria**:
  - [ ] `DEFAULTS.templateDir`이 `'.opencode/context/templates'`로 설정
  - [ ] 기존 속성 모두 유지
  - [ ] TypeScript 컴파일 에러 없음

  **QA Scenarios:**

  ```
  Scenario: constants.ts 타입체크 통과
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. bunx tsc --noEmit src/constants.ts
      2. 에러 출력 확인
    Expected Result: 에러 없이 종료 (exit code 0)
    Failure Indicators: TypeScript 컴파일 에러 메시지
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Message: `feat(scaffold): add Zettelkasten guide and note templates to hook content`
  - Files: `src/constants.ts`

---

- [ ] 2. 8개 개별 템플릿 파일 콘텐츠 작성

  **What to do**:
  - `src/lib/scaffold.ts`에 8개 템플릿 상수를 추가. 각 상수는 해당 템플릿 파일의 콘텐츠.
  - scaffold.ts 내에 `TEMPLATE_FILES` 매핑 객체도 추가하여 파일명과 콘텐츠를 연결:

  ```typescript
  // 각 템플릿 상수 정의 후, 매핑 객체로 묶기
  const TEMPLATE_FILES: Record<string, string> = {
    'adr.md': DEFAULT_ADR_TEMPLATE,
    'pattern.md': DEFAULT_PATTERN_TEMPLATE,
    'bug.md': DEFAULT_BUG_TEMPLATE,
    'gotcha.md': DEFAULT_GOTCHA_TEMPLATE,
    'decision.md': DEFAULT_DECISION_TEMPLATE,
    'context.md': DEFAULT_CONTEXT_TEMPLATE,
    'runbook.md': DEFAULT_RUNBOOK_TEMPLATE,
    'insight.md': DEFAULT_INSIGHT_TEMPLATE,
  };
  ```

  - 각 템플릿 콘텐츠는 아래 구조를 따름 (한국어, 빈칸 채우기 형태):

  **adr.md** -- Architecture Decision Record

  ```markdown
  # ADR-NNN: [제목]

  ## 상태

  Accepted | Deprecated | Superseded by [[ADR-YYY]]

  ## 맥락

  이 결정을 내리게 된 배경/문제 상황

  ## 결정

  무엇을 어떻게 하기로 했는지

  ## 결과

  ### 긍정적

  - ...

  ### 부정적 (트레이드오프)

  - ...

  ## 관련 노트

  - [[관련-결정.md]] / [[관련-패턴.md]]
  ```

  **pattern.md** -- 코드 패턴/컨벤션

  ```markdown
  # Pattern: [패턴 이름]

  ## 문제

  이 패턴이 해결하는 문제

  ## 해법

  // 패턴의 대표적 예시 코드

  ## 사용 시점

  - 이럴 때 사용

  ## 사용하지 말 것

  - 이럴 때는 사용 금지 (안티패턴 경고)

  ## 코드베이스 내 예시

  - [[경로/파일.ts]] -- 실제 적용 사례

  ## 관련 패턴

  - [[대안-패턴.md]] / [[보완-패턴.md]]
  ```

  **bug.md** -- 버그 패턴 + 해결

  ```markdown
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
  ```

  **gotcha.md** -- 외부 라이브러리/API 함정

  ```markdown
  # Gotcha: [라이브러리] -- [함정 설명]

  ## 예상 vs 실제

  예상한 동작과 실제 동작의 차이

  ## 우회법

  // 작동하는 해결 코드

  ## 원인 (알려진 경우)

  왜 이렇게 동작하는지

  ## 관련

  - 이슈: [GitHub issue / 문서 링크]
  - [[관련-gotcha.md]]
  ```

  **decision.md** -- 경량 결정 로그

  ```markdown
  # Decision: [제목]

  ## 결정

  무엇을 선택했는지

  ## 근거

  왜 이것을 선택했는지

  ## 고려한 대안

  - 대안 1: 탈락 이유
  - 대안 2: 탈락 이유

  ## 관련 노트

  - [[관련-ADR.md]] / [[관련-패턴.md]]
  ```

  **context.md** -- 프로젝트/모듈 맥락

  ```markdown
  # Context: [프로젝트/모듈명]

  ## 개요

  무엇이고 무엇을 하는지

  ## 기술 스택

  - 언어 / 프레임워크 / 주요 라이브러리

  ## 아키텍처

  고수준 구조와 패턴

  ## 컨벤션

  - 파일 구조 / 네이밍 / 테스트 방식

  ## 진입점

  - [[src/index.ts]] / [[config.json]]

  ## 관련 노트

  - [[관련-context.md]] / [[주요-ADR.md]]
  ```

  **runbook.md** -- 절차서

  ```markdown
  # Runbook: [절차 이름]

  ## 목적

  이 절차가 달성하는 것

  ## 사전 조건

  - 필요한 것 1

  ## 단계

  1. 첫 번째 단계
  2. 두 번째 단계

  ## 확인 방법

  성공했는지 확인하는 방법

  ## 문제 해결

  | 증상   | 해결            |
  | ------ | --------------- |
  | 이슈 1 | [[관련-bug.md]] |

  ## 관련 노트

  - [[관련-runbook.md]] / [[관련-context.md]]
  ```

  **insight.md** -- 발견/학습

  ```markdown
  # Insight: [발견 제목]

  ## 발견

  무엇을 알게 되었는지

  ## 맥락

  어떻게 발견했는지 (어떤 작업 중, 어떤 실험)

  ## 시사점

  이것이 향후 작업에 미치는 영향

  ## 적용

  이 발견을 바탕으로 어떻게 행동을 바꿔야 하는지

  ## 관련 노트

  - [[관련-insight.md]] / [[영향받는-패턴.md]] / [[관련-ADR.md]]
  ```

  - 각 템플릿 상수는 backtick template literal로 작성 (기존 DEFAULT_TURN_START 패턴과 동일)
  - 전체 내용은 한국어로 작성

  **Must NOT do**:
  - 기존 DEFAULT_TURN_START, DEFAULT_TURN_END 수정 금지 (이 태스크에서는 템플릿 콘텐츠만)
  - 과도한 설명/튜토리얼 삽입 금지 -- 템플릿은 빈칸 채우기 형태여야 함
  - scaffold 함수 수정 금지 (Task 5에서 처리)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 8개 노트 템플릿 콘텐츠를 한국어로 작성하는 문서 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:18-31` -- DEFAULT_TURN_START 상수 작성 패턴 (backtick template literal)
  - `src/lib/scaffold.ts:33-50` -- DEFAULT_TURN_END 상수 작성 패턴

  **External References**:
  - ADR 형식 참조: Michael Nygard의 ADR 표준 구조 (Status, Context, Decision, Consequences)

  **WHY Each Reference Matters**:
  - scaffold.ts 패턴: 문자열 상수를 동일한 방식(backtick template literal)으로 작성해야 함

  **Acceptance Criteria**:
  - [ ] 8개 개별 템플릿 상수가 scaffold.ts에 존재 (DEFAULT_ADR_TEMPLATE, DEFAULT_PATTERN_TEMPLATE, ...)
  - [ ] TEMPLATE_FILES 매핑 객체가 존재하여 파일명-콘텐츠 연결
  - [ ] 각 템플릿에 제목, 섹션 구조, 관련 노트 링크 형식 포함
  - [ ] 전체 한국어 작성
  - [ ] TypeScript 컴파일 에러 없음

  **QA Scenarios:**

  ```
  Scenario: 8개 템플릿 상수 모두 존재 확인
    Tool: Bash (grep)
    Preconditions: Task 2 완료
    Steps:
      1. grep -c 'DEFAULT_.*_TEMPLATE' src/lib/scaffold.ts
      2. 카운트 확인
    Expected Result: 8 이상 (각 템플릿 상수가 존재)
    Failure Indicators: 8 미만이면 누락된 템플릿 존재
    Evidence: .sisyphus/evidence/task-2-template-constants.txt

  Scenario: TEMPLATE_FILES 매핑 객체 존재 확인
    Tool: Bash (grep)
    Preconditions: Task 2 완료
    Steps:
      1. grep 'TEMPLATE_FILES' src/lib/scaffold.ts
      2. 결과 확인
    Expected Result: 매핑 객체 정의가 출력됨
    Failure Indicators: 출력 없음
    Evidence: .sisyphus/evidence/task-2-mapping-exists.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Files: `src/lib/scaffold.ts`

---

- [ ] 3. DEFAULT_TURN_START 리라이트 -- 제텔카스텐 핵심 원칙 + 지식 읽기 가이드

  **What to do**:
  - `src/lib/scaffold.ts`의 `DEFAULT_TURN_START` 상수를 아래 구조로 완전히 대체:

  ```markdown
  ## Knowledge Context

  이 프로젝트는 **제텔카스텐(Zettelkasten)** 방식으로 지식을 관리합니다.
  세션 간 컨텍스트를 보존하여, 이전 세션의 결정/패턴/실수가 다음 세션에서 재활용됩니다.

  ### 제텔카스텐 핵심 원칙

  1. **원자성** -- 하나의 노트 = 하나의 주제. 여러 주제를 섞지 마세요.
  2. **연결** -- 모든 노트는 [[wikilink]]로 관련 노트에 연결. 고립된 노트는 발견되지 않습니다.
  3. **자기 언어** -- 복사-붙여넣기가 아닌, 핵심을 이해하고 간결하게 서술하세요.

  ### 작업 전 필수

  - 아래 **Available Knowledge** 목록에서 현재 작업과 관련된 문서를 **먼저** 읽으세요
  - 문서 내 [[링크]]를 따라가며 관련 노트를 탐색하세요 -- 링크를 놓치면 중요한 맥락을 잃습니다
  - 지식 파일에 기록된 아키텍처 결정, 패턴, 제약사항을 반드시 따르세요

  ### 우선순위

  - AGENTS.md의 지시사항이 항상 최우선
  - 지식 노트의 결정사항 > 일반적 관행
  - 지식 노트에 없는 새로운 결정은 작업 완료 시 기록하세요
  ```

  - 위 내용을 정확히 `DEFAULT_TURN_START` 상수로 구현
  - backtick template literal 형식 유지 (기존 패턴 동일)

  **Must NOT do**:
  - DEFAULT_TURN_END 수정 금지
  - 템플릿 상수 수정 금지
  - scaffold 함수 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 상수 교체, 명확한 대상 콘텐츠 제공
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:18-31` -- 현재 DEFAULT_TURN_START 상수. 이 전체를 대체할 것

  **Acceptance Criteria**:
  - [ ] DEFAULT_TURN_START에 제텔카스텐 3대 원칙(원자성, 연결, 자기 언어) 설명 포함
  - [ ] Available Knowledge 읽기 지시 포함
  - [ ] 우선순위 규칙 포함
  - [ ] 한국어 작성
  - [ ] TypeScript 컴파일 에러 없음

  **QA Scenarios:**

  ```
  Scenario: turn-start에 제텔카스텐 원칙 포함 확인
    Tool: Bash (grep)
    Preconditions: Task 3 완료
    Steps:
      1. grep -c '원자성\|연결\|자기 언어' src/lib/scaffold.ts
      2. 카운트 확인
    Expected Result: 3 이상 (세 원칙 모두 언급)
    Evidence: .sisyphus/evidence/task-3-principles.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Files: `src/lib/scaffold.ts`

---

- [ ] 4. DEFAULT_TURN_END 리라이트 -- 유형별 트리거 조건 + 개별 템플릿 파일 링크

  **What to do**:
  - `src/lib/scaffold.ts`의 `DEFAULT_TURN_END` 상수를 아래 구조로 완전히 대체:

  ```markdown
  ## 작업 마무리 체크리스트

  작업을 완료하기 전에 반드시:

  ### 퀄리티 보장

  - [ ] 변경한 코드에 대해 lint 실행
  - [ ] 타입 에러 확인
  - [ ] 기존 테스트 통과 확인

  ### 지식 정리 (Zettelkasten)

  아래 상황에 해당하면, 해당 템플릿 파일을 읽고 그 구조에 맞춰 노트를 작성하세요.

  | 상황                            | 템플릿                                              | 파일명 패턴                 |
  | ------------------------------- | --------------------------------------------------- | --------------------------- |
  | 아키텍처/기술 스택 중대 결정    | [ADR](.opencode/context/templates/adr.md)           | `adr-NNN-제목.md`           |
  | 반복 사용할 코드 패턴 발견      | [Pattern](.opencode/context/templates/pattern.md)   | `pattern-제목.md`           |
  | 비자명한 버그 해결              | [Bug](.opencode/context/templates/bug.md)           | `bug-제목.md`               |
  | 외부 API/라이브러리 예상외 동작 | [Gotcha](.opencode/context/templates/gotcha.md)     | `gotcha-라이브러리-제목.md` |
  | 작은 기술적 선택                | [Decision](.opencode/context/templates/decision.md) | `decision-제목.md`          |
  | 모듈/프로젝트 개요 필요         | [Context](.opencode/context/templates/context.md)   | `context-제목.md`           |
  | 반복 가능한 프로세스 정립       | [Runbook](.opencode/context/templates/runbook.md)   | `runbook-제목.md`           |
  | 실험/디버깅 중 학습             | [Insight](.opencode/context/templates/insight.md)   | `insight-제목.md`           |

  - [ ] 위 상황에 해당하는 발견이 있었다면 노트를 작성했는가?
  - [ ] 관련 기존 노트에 [[링크]]를 추가했는가?
  - [ ] 기존 노트의 내용이 변경사항과 불일치하면 업데이트했는가?

  #### 노트 작성 규칙

  - 첫 줄: 명확한 제목 (`# Title`)
  - 핵심 내용을 자신의 언어로 간결하게 서술
  - 관련 노트를 `[[relative/path/file.md]]` 형태의 wikilink로 연결
  - knowledge 디렉토리 (기본: `docs/`)에 저장
  ```

  **핵심 변경점**: 템플릿 이름 컬럼에 **개별 파일 경로 링크**를 포함하여, 에이전트가 해당 상황에 맞는 템플릿 파일만 선택적으로 Read할 수 있게 함. 불필요한 템플릿을 모두 읽을 필요 없음.
  - 위 내용을 정확히 `DEFAULT_TURN_END` 상수로 구현
  - 기존 퀄리티 보장 체크리스트(lint, 타입, 테스트) 반드시 유지
  - 템플릿 링크는 마크다운 링크 형식 `[이름](경로)` 사용

  **Must NOT do**:
  - DEFAULT_TURN_START 수정 금지
  - 템플릿 상수 수정 금지
  - scaffold 함수 수정 금지
  - 퀄리티 체크리스트 삭제/축소 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 상수 교체, 명확한 대상 콘텐츠 제공
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:33-50` -- 현재 DEFAULT_TURN_END 상수. 이 전체를 대체할 것
  - `src/constants.ts` -- DEFAULTS.templateDir 경로 확인 (Task 1에서 추가)

  **WHY Each Reference Matters**:
  - scaffold.ts 현재 turn-end: 대체 대상 확인 + backtick 문자열 패턴
  - constants.ts: 템플릿 참조 경로가 상수와 일치하는지 확인

  **Acceptance Criteria**:
  - [ ] 기존 퀄리티 체크리스트 (lint, 타입, 테스트) 유지
  - [ ] 8가지 템플릿 유형별 트리거 조건 + 파일명 패턴 표 포함
  - [ ] 각 템플릿 이름에 **개별 파일 경로 링크** 포함 (`.opencode/context/templates/*.md`)
  - [ ] 노트 작성 규칙 포함
  - [ ] knowledge 디렉토리 저장 안내 포함
  - [ ] 한국어 작성

  **QA Scenarios:**

  ```
  Scenario: turn-end에 개별 템플릿 파일 링크 8개 포함 확인
    Tool: Bash (grep)
    Preconditions: Task 4 완료
    Steps:
      1. grep -c '.opencode/context/templates/' src/lib/scaffold.ts (DEFAULT_TURN_END 컨텍스트)
      2. 카운트 확인
    Expected Result: 8 이상 (각 템플릿 파일 경로가 모두 존재)
    Failure Indicators: 8 미만이면 누락된 템플릿 링크
    Evidence: .sisyphus/evidence/task-4-template-links.txt

  Scenario: 퀄리티 체크리스트 유지 확인
    Tool: Bash (grep)
    Preconditions: Task 4 완료
    Steps:
      1. grep -c 'lint\|타입 에러\|테스트 통과' src/lib/scaffold.ts
      2. 카운트 확인
    Expected Result: 3 이상 (세 가지 체크 항목 모두 존재)
    Evidence: .sisyphus/evidence/task-4-quality-checklist.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Files: `src/lib/scaffold.ts`

---

- [ ] 5. scaffold 함수 업데이트 -- templates 디렉토리 + 8개 파일 자동 생성

  **What to do**:
  - `scaffoldIfNeeded()` 함수 수정:
    - `prompts/` 디렉토리 생성 후 `templates/` 디렉토리도 생성 (`DEFAULTS.templateDir` 사용)
    - `TEMPLATE_FILES` 매핑 객체를 순회하며 8개 템플릿 파일 생성
  - `updateScaffold()` 함수 수정:
    - `templates` Record 객체에 8개 템플릿 파일 항목 추가
    - `TEMPLATE_FILES` 매핑을 사용하여 각 파일의 키를 `templates/${filename}` 형식으로 구성
    - 기존 3개 (config, turn-start, turn-end) + 8개 (templates) = 11개
    - `mkdirSync`로 templates 디렉토리도 보장
  - `DEFAULTS`와 `TEMPLATE_FILES`를 적절히 사용

  **Must NOT do**:
  - DEFAULT_TURN_START, DEFAULT_TURN_END, 템플릿 상수 콘텐츠 수정 금지
  - config 로딩 로직 수정 금지
  - knowledge-index 로직 수정 금지
  - 기존 prompts/ 파일 경로 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 함수 로직에 파일/디렉토리 생성 추가하는 간단한 작업
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: scaffold 패턴과 플러그인 구조 이해에 도움

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (constants.ts), Task 2 (TEMPLATE_FILES)

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:52-72` -- `scaffoldIfNeeded()` 함수. mkdirSync + writeFileSync 패턴 동일하게 확장
  - `src/lib/scaffold.ts:74-97` -- `updateScaffold()` 함수. templates Record 객체에 항목 추가하는 패턴
  - `src/constants.ts` -- DEFAULTS 객체에서 templateDir 사용

  **WHY Each Reference Matters**:
  - scaffoldIfNeeded: mkdirSync recursive 패턴과 writeFileSync 호출 순서를 따라야 함
  - updateScaffold: templates Record 객체의 키 형식을 따라야 함 (`경로/파일명`)

  **Acceptance Criteria**:
  - [ ] `scaffoldIfNeeded()`가 `.opencode/context/templates/` 디렉토리 생성
  - [ ] `scaffoldIfNeeded()`가 8개 개별 템플릿 파일 모두 생성
  - [ ] `updateScaffold()`가 8개 템플릿 파일을 업데이트 대상에 포함
  - [ ] 기존 3개 파일 (config, turn-start, turn-end) 동작 유지
  - [ ] DEFAULTS.templateDir 상수 활용 (하드코딩 없음)
  - [ ] TypeScript 컴파일 에러 없음

  **QA Scenarios:**

  ```
  Scenario: updateScaffold가 11개 파일을 관리하는지 확인
    Tool: Bash (grep)
    Preconditions: Task 5 완료
    Steps:
      1. grep 'TEMPLATE_FILES\|templates/' src/lib/scaffold.ts 에서 updateScaffold 컨텍스트 확인
      2. updateScaffold 함수 내 templates 객체에 8개 템플릿 항목 포함 확인
    Expected Result: updateScaffold의 templates Record에 8개 템플릿 관련 항목 존재
    Evidence: .sisyphus/evidence/task-5-update-scaffold.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Files: `src/lib/scaffold.ts`

---

- [ ] 6. scaffold.test.ts 업데이트

  **What to do**:
  - 기존 테스트의 assertions 업데이트:
    - `scaffoldIfNeeded` 테스트: templates 디렉토리 + 8개 파일 생성 검증 추가
    - `updateScaffold` 테스트: 11개 파일 (기존 3 + 8 templates) 업데이트 검증
  - 신규 테스트 추가:
    - templates 디렉토리가 scaffold 결과에 포함되는지 확인
    - 8개 개별 템플릿 파일 각각의 존재 확인
    - 각 템플릿 파일 내용에 해당 유형의 키워드 존재 확인
    - updateScaffold가 변경된 템플릿을 업데이트 대상에 포함하는지 확인
  - 기존 테스트 패턴(describe/it, expect, 임시 디렉토리 사용) 따르기

  **Must NOT do**:
  - 기존 테스트 삭제 금지 -- 업데이트만
  - 소스 코드 수정 금지 -- 테스트만
  - 테스트 프레임워크/설정 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 기존 테스트 패턴을 따라 assertions 업데이트/추가
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 3, 4, 5

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.test.ts` -- 전체 파일. 기존 테스트 구조와 패턴을 따라야 함
  - `src/lib/scaffold.ts` -- 테스트 대상. scaffoldIfNeeded, updateScaffold 함수 시그니처

  **Acceptance Criteria**:
  - [ ] `bun test scaffold.test.ts` 통과
  - [ ] scaffoldIfNeeded가 templates 디렉토리 + 8개 파일 생성하는 테스트 존재
  - [ ] updateScaffold가 11개 파일 처리하는 테스트 존재
  - [ ] 기존 테스트 모두 통과 유지

  **QA Scenarios:**

  ```
  Scenario: scaffold 테스트 전체 통과
    Tool: Bash
    Preconditions: Task 6 완료
    Steps:
      1. bun test scaffold.test.ts
      2. 테스트 결과 확인
    Expected Result: 모든 테스트 통과 (0 failures)
    Evidence: .sisyphus/evidence/task-6-test-results.txt
  ```

  **Commit**: YES (groups with all tasks)
  - Files: `src/lib/scaffold.test.ts`

---

- [ ] 7. 최종 검증 -- lint, typecheck, test, build

  **What to do**:
  - 전체 프로젝트 검증 명령 실행:
    1. `mise run lint` -- 린트 통과 확인
    2. `bun test` -- 전체 테스트 통과 확인
    3. `mise run build` -- 빌드 성공 확인
  - 모든 명령이 에러 없이 통과해야 함
  - 실패 시 원인 파악 후 해당 태스크 수정

  **Must NOT do**:
  - 소스 코드 수정 금지 (검증만) -- 실패 시 이전 태스크로 돌아가야 함
  - 테스트 스킵/비활성화 금지
  - 린트 규칙 변경/비활성화 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 명령 실행 + 결과 확인만
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 6)
  - **Blocks**: F1, F2
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `AGENTS.md` -- 빌드/테스트 명령어 참조

  **Acceptance Criteria**:
  - [ ] `mise run lint` -- exit code 0
  - [ ] `bun test` -- 모든 테스트 통과
  - [ ] `mise run build` -- 빌드 성공

  **QA Scenarios:**

  ```
  Scenario: 전체 프로젝트 검증 통과
    Tool: Bash
    Preconditions: Tasks 1-6 모두 완료
    Steps:
      1. mise run lint
      2. bun test
      3. mise run build
    Expected Result: 세 명령 모두 exit code 0
    Evidence: .sisyphus/evidence/task-7-final-verification.txt
  ```

  **Commit**: YES (final commit)
  - Message: `feat(scaffold): add Zettelkasten guide and note templates to hook content`
  - Files: `src/constants.ts`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`
  - Pre-commit: `bun test && mise run lint`

---

## Final Verification Wave

> 2 review agents run in PARALLEL. ALL must APPROVE. Rejection -> fix -> re-run.

- [ ] F1. **Plan Compliance Audit** -- `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns -- reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** -- `unspecified-high`
      Run `mise run lint` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify string constants are well-formatted and don't have trailing whitespace issues.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

---

## Commit Strategy

- **Single commit** after all tasks complete:
  - Message: `feat(scaffold): add Zettelkasten guide and note templates to hook content`
  - Files: `src/constants.ts`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`
  - Pre-commit: `bun test && mise run lint`

---

## Success Criteria

### Verification Commands

```bash
bun test                    # Expected: all tests pass
mise run lint               # Expected: no errors
mise run build              # Expected: build succeeds
```

### Final Checklist

- [ ] turn-start에 제텔카스텐 핵심 원칙 3가지 포함
- [ ] turn-end에 8가지 템플릿 유형 가이드 + **개별 파일 링크** 포함
- [ ] `.opencode/context/templates/`에 8개 개별 템플릿 파일 존재
- [ ] scaffold가 templates 디렉토리 + 8개 파일 자동 생성
- [ ] updateScaffold가 8개 템플릿 파일 업데이트 대상 포함
- [ ] 기존 퀄리티 체크리스트 유지
- [ ] 모든 테스트 통과
- [ ] 린트 통과
- [ ] 빌드 성공
