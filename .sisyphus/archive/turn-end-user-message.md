# Turn-End 프롬프트를 Synthetic User Message로 이동

## TL;DR

> **Quick Summary**: turn-end.md 인젝션을 시스템 프롬프트(`output.system.push`)에서 `experimental.chat.messages.transform` 훅을 통한 synthetic user message로 이동. `<system-reminder>` 태그로 감싸서 모델이 시스템 리마인더로 인식하도록 함.
>
> **Deliverables**:
>
> - `src/index.ts` — turn-end 인젝션 위치 변경 (system → messages transform)
> - `src/index.test.ts` — 기존 테스트 업데이트 + 신규 테스트 추가
> - `docs/architecture.md` — 아키텍처 문서 업데이트
>
> **Estimated Effort**: Quick
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 2 → Final Verification

---

## Context

### Original Request

turn-end 프롬프트를 에이전트 턴 끝난 다음 유저 메시지처럼 인젝트하고 싶음.

### Interview Summary

**Key Discussions**:

- **인젝션 방식**: 별도 synthetic UserMessage를 messages 배열 끝에 push (방식 B 선택)
- **태그 래핑**: `<system-reminder>` 태그로 감싸기
- **변경 범위**: turn-end만. turn-start + knowledge index는 system prompt에 유지

**Research Findings**:

- `experimental.chat.messages.transform` 훅 존재 확인: `(input: {}, output: { messages: { info: Message; parts: Part[] }[] }) => Promise<void>`
- `UserMessage` 타입 필수 필드: `id`, `sessionID`, `role: "user"`, `time: { created }`, `agent`, `model: { providerID, modelID }`
- `TextPart` 타입 필수 필드: `id`, `sessionID`, `messageID`, `type: "text"`, `text` + optional `synthetic: true`
- `input` 객체가 `{}`로 비어있음 → sessionID/agent/model을 기존 메시지에서 추출 필요

### Metis Review

**Identified Gaps** (addressed):

- synthetic 메시지 필드 파생 전략 → 마지막 UserMessage에서 추출
- 빈 messages 배열 엣지 케이스 → skip injection
- TextPart에 `synthetic: true` 설정 → 적용
- 중복 인젝션 우려 → output이 매 호출마다 새로 제공되므로 문제 없음

---

## Work Objectives

### Core Objective

turn-end.md 콘텐츠의 인젝션 위치를 시스템 프롬프트에서 대화 히스토리 끝의 synthetic user message로 이동.

### Concrete Deliverables

- `src/index.ts`: `experimental.chat.messages.transform` 훅 추가, turn-end를 system.transform에서 제거
- `src/index.test.ts`: 기존 테스트 업데이트 + 4개 이상 신규 테스트
- `docs/architecture.md`: 인젝션 플로우 다이어그램 업데이트

### Definition of Done

- [ ] `bun test` → 모든 테스트 통과
- [ ] `mise run lint` → 에러 없음
- [ ] `mise run build` → 빌드 성공
- [ ] turn-end 콘텐츠가 `output.system`에 포함되지 않음
- [ ] turn-end 콘텐츠가 `output.messages`의 마지막 synthetic user message에 `<system-reminder>` 태그로 감싸져 있음

### Must Have

- turn-end.md 콘텐츠가 `<system-reminder>` 태그로 감싸진 synthetic UserMessage로 인젝트
- 기존 turn-start + knowledge index 인젝션은 system prompt에 그대로 유지
- 빈 messages 배열 시 안전하게 skip
- 빈 turn-end.md 파일 시 인젝션 skip
- TextPart에 `synthetic: true` 설정
- 기존 hot-reload 기능 유지 (매 턴마다 파일 새로 읽기)
- 기존 테스트 모두 통과 (turn-end 관련 테스트는 업데이트)

### Must NOT Have (Guardrails)

- turn-start.md 인젝션 로직 수정 금지
- knowledge index 빌드/인젝션 로직 수정 금지
- 새로운 config 옵션 추가 금지 (e.g. `injectTurnEndAsUser`)
- 새로운 `client.app.log()` 호출 추가 금지
- turn-end.md 파일 읽기 로직 변경 금지 (기존 `readPromptFile` 사용)
- `as any` 또는 `@ts-ignore` 사용 금지 (테스트 mock 제외)
- 과도한 주석/JSDoc 추가 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (기존 테스트 패턴 따르기)
- **Framework**: vitest

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (bun test) — 테스트 실행, 결과 확인
- **Build**: Use Bash (mise run build, mise run lint) — 빌드/린트 성공 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — core implementation + tests):
├── Task 1: Move turn-end injection to messages.transform hook + update tests [deep]

Wave 2 (After Wave 1 — documentation):
├── Task 2: Update architecture docs [quick]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Full test suite + build + lint verification [quick]
├── Task F2: Scope fidelity check [quick]
```

### Dependency Matrix

| Task | Depends On | Blocks   | Wave  |
| ---- | ---------- | -------- | ----- |
| 1    | —          | 2, F1-F2 | 1     |
| 2    | 1          | F1-F2    | 2     |
| F1   | 1, 2       | —        | FINAL |
| F2   | 1, 2       | —        | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 1 task — T1 → `deep`
- **Wave 2**: 1 task — T2 → `quick`
- **FINAL**: 2 tasks — F1 → `quick`, F2 → `quick`

---

## TODOs

- [ ] 1. Move turn-end injection from system.transform to messages.transform + 테스트 업데이트

  **What to do**:
  - `src/index.ts`에서 `experimental.chat.system.transform` 훅 내 turn-end 인젝션 제거:
    - 현재 70행 `if (turnEnd) output.system.push(turnEnd);` 삭제
    - `turnEnd` 관련 변수 선언(57-58행의 `turnEndPath`, `turnEnd`)은 새 훅으로 이동
  - `src/index.ts`에 `experimental.chat.messages.transform` 훅 추가:
    - turn-end.md 파일을 `readPromptFile()`로 읽기 (매 호출마다 fresh read — hot-reload 유지)
    - 읽은 콘텐츠가 비어있으면 early return
    - `output.messages` 배열이 비어있으면 early return
    - 마지막 UserMessage에서 `sessionID`, `agent`, `model` 추출 (`.filter(m => m.info.role === 'user').at(-1)`)
    - UserMessage를 찾을 수 없으면 early return
    - synthetic UserMessage 구성:
      ```typescript
      {
        info: {
          id: `context-turn-end-${Date.now()}`,
          sessionID: lastUserMsg.info.sessionID,
          role: 'user' as const,
          time: { created: Date.now() },
          agent: lastUserMsg.info.agent,
          model: lastUserMsg.info.model,
        },
        parts: [{
          id: `context-turn-end-part-${Date.now()}`,
          sessionID: lastUserMsg.info.sessionID,
          messageID: `context-turn-end-${Date.now()}`,
          type: 'text' as const,
          text: `<system-reminder>\n${turnEnd}\n</system-reminder>`,
          synthetic: true,
        }],
      }
      ```
    - `output.messages.push(syntheticMessage)`
  - `src/index.test.ts` 업데이트:
    - 기존 테스트 "injects turn-end content into output.system" (59-71행) → 반전:
      `expect(output.system.some((s) => s.includes('TURN END CONTENT'))).toBe(false)` 로 변경
      테스트 이름: `'does NOT inject turn-end content into output.system'`
    - 기존 테스트 "returns hooks object with experimental.chat.system.transform" (33-37행) →
      `experimental.chat.messages.transform` 훅도 존재하는지 추가 검증
    - 신규 테스트 추가:
      1. `'injects turn-end as synthetic user message via messages.transform'`
         - turn-end.md에 내용 작성
         - messages.transform 호출 시 기존 UserMessage가 포함된 messages 배열 제공
         - 결과: messages 배열 끝에 synthetic user message 추가됨
         - 검증: `role === 'user'`, `<system-reminder>` 태그 포함, `synthetic: true`
      2. `'skips turn-end injection when messages array is empty'`
         - 빈 messages 배열로 호출
         - 결과: messages 배열 여전히 비어있음, 크래시 없음
      3. `'skips turn-end injection when turn-end.md is empty'`
         - turn-end.md를 빈 파일로 생성
         - 결과: messages 배열에 synthetic message 미추가
      4. `'hot-reloads turn-end content in messages.transform'`
         - 첫 호출 → OLD CONTENT 확인
         - 파일 변경
         - 두 번째 호출 → NEW CONTENT 확인

  **Must NOT do**:
  - turn-start.md 인젝션 로직 수정 금지
  - knowledge index 로직 수정 금지
  - 새 config 옵션 추가 금지
  - `readPromptFile` 함수 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 훅 API 타입 구조 이해 + 여러 파일 동시 수정 + 테스트 작성이 필요한 중간 복잡도 작업
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: 플러그인 훅 API 레퍼런스와 타입 정보 필수
  - **Skills Evaluated but Omitted**:
    - `python-pro`: 언어 불일치
    - `playwright`: 브라우저 테스트 아님

  **Parallelization**:
  - **Can Run In Parallel**: NO (단독 Wave 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2, F1, F2
  - **Blocked By**: None (즉시 시작 가능)

  **References** (CRITICAL):

  **Pattern References** (existing code to follow):
  - `src/index.ts:46-71` — 현재 `experimental.chat.system.transform` 훅 구현. 이 패턴을 따라 새 훅을 같은 return 객체에 추가
  - `src/index.ts:57-58` — `turnEndPath`, `turnEnd` 변수 선언. 이 로직을 새 훅으로 이동
  - `src/index.ts:70` — `if (turnEnd) output.system.push(turnEnd)` — 이 줄을 삭제해야 함
  - `src/index.test.ts:44-71` — turn-start/turn-end 테스트 패턴. 이 구조를 따라 messages.transform 테스트 작성
  - `src/index.test.ts:10-19` — `createMockInput` 함수. 테스트에서 사용하는 mock 패턴

  **API/Type References** (contracts to implement against):
  - `node_modules/@opencode-ai/plugin/dist/index.d.ts:191-196` — `experimental.chat.messages.transform` 훅 시그니처
  - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:39-60` — `UserMessage` 타입 전체 구조
  - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:142-157` — `TextPart` 타입 (특히 `synthetic?: boolean` 필드)
  - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:128` — `Message = UserMessage | AssistantMessage` 유니온 타입

  **Config/Constants References:**
  - `src/constants.ts:1-8` — DEFAULTS 객체 (turnEndFile 경로)
  - `src/constants.ts:10-16` — LIMITS 객체 (maxPromptFileSize)
  - `src/lib/prompt-reader.ts:4-14` — `readPromptFile` 함수 (그대로 사용)

  **WHY Each Reference Matters:**
  - 현재 훅 구현(46-71행): 새 훅을 같은 return 객체에 추가하는 패턴 파악 + turnEnd 관련 코드 위치 확인
  - SDK 타입(39-60, 142-157행): synthetic UserMessage와 TextPart 구성 시 필수/선택 필드 정확히 알아야 타입 에러 방지
  - 테스트 패턴(44-71행): 기존 테스트 스타일과 일관성 유지 필요

  **Acceptance Criteria**:

  - [ ] `bun test src/index.test.ts` → 모든 테스트 통과 (기존 + 신규 4개)
  - [ ] `mise run lint` → 에러 없음
  - [ ] turn-end 콘텐츠가 `output.system`에 포함되지 않음 (테스트로 검증)
  - [ ] synthetic user message가 `output.messages` 끝에 추가됨 (테스트로 검증)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: turn-end가 synthetic user message로 인젝트됨
    Tool: Bash (bun test)
    Preconditions: src/index.ts 수정 완료, src/index.test.ts 업데이트 완료
    Steps:
      1. `bun test src/index.test.ts` 실행
      2. 테스트 결과에서 'injects turn-end as synthetic user message' 테스트 통과 확인
      3. 테스트 결과에서 'does NOT inject turn-end content into output.system' 테스트 통과 확인
    Expected Result: 모든 테스트 통과 (0 failures)
    Failure Indicators: 'FAIL' 문자열이 출력에 포함, exit code !== 0
    Evidence: .sisyphus/evidence/task-1-tests-pass.txt

  Scenario: 빈 messages 배열에서 크래시 없음
    Tool: Bash (bun test)
    Preconditions: 빈 배열 엣지 케이스 테스트 작성 완료
    Steps:
      1. `bun test src/index.test.ts -t 'skips turn-end injection when messages array is empty'`
      2. 테스트 통과 확인
    Expected Result: PASS, messages 배열 여전히 비어있음
    Failure Indicators: TypeError, Cannot read properties of undefined
    Evidence: .sisyphus/evidence/task-1-empty-messages.txt

  Scenario: 빌드 성공 확인
    Tool: Bash (mise run build)
    Preconditions: src/index.ts 수정 완료
    Steps:
      1. `mise run build` 실행
      2. exit code 0 확인
      3. `ls -la dist/index.js` 로 출력 파일 존재 확인
    Expected Result: 빌드 성공, dist/index.js 생성
    Failure Indicators: TypeScript 타입 에러, 빌드 실패 메시지
    Evidence: .sisyphus/evidence/task-1-build.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-tests-pass.txt — bun test 전체 결과
  - [ ] task-1-empty-messages.txt — 엣지 케이스 테스트 결과
  - [ ] task-1-build.txt — mise run build 결과

  **Commit**: YES
  - Message: `refactor(prompt): move turn-end injection from system prompt to synthetic user message`
  - Files: `src/index.ts`, `src/index.test.ts`
  - Pre-commit: `bun test && mise run build`

- [ ] 2. Architecture 문서 업데이트

  **What to do**:
  - `docs/architecture.md` 업데이트:
    - "Injection Flow" 섹션의 다이어그램 수정:
      - 기존: `[turn-end.md]` 가 system prompt에 포함
      - 변경: `[turn-end.md]`가 `experimental.chat.messages.transform`을 통해 synthetic user message로 인젝트
    - "Plugin Entry Point" 섹션 코드 예시에 `experimental.chat.messages.transform` 훅 추가
    - `<system-reminder>` 태그 래핑 설명 추가
    - 설계 결정 섹션에 인젝션 방식 변경 이유 기록

  **Must NOT do**:
  - 다른 섹션 (Config Loader, Knowledge Index Builder, Prompt Reader, Scaffold System, Safety Limits) 수정 금지
  - 새로운 섹션 추가 금지 (기존 섹션 내에서 업데이트)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 문서 텍스트 수정만 필요한 단순 작업
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `technical-writer`: 이 규모에서는 과도함

  **Parallelization**:
  - **Can Run In Parallel**: NO (Task 1 완료 후)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1, F2
  - **Blocked By**: Task 1

  **References:**

  **Pattern References:**
  - `docs/architecture.md:5-15` — 현재 Injection Flow 다이어그램. 이 부분을 수정해야 함
  - `docs/architecture.md:95-109` — Plugin Entry Point 코드 예시. 새 훅 추가 반영 필요
  - `docs/architecture.md:111-115` — 설계 결정 섹션. 변경 이유 기록

  **WHY Each Reference Matters:**
  - Injection Flow(5-15행): 사용자가 가장 먼저 보는 아키텍처 개요. 정확해야 함
  - Entry Point(95-109행): 코드 구조 요약. 새 훅이 반영되어야 함

  **Acceptance Criteria**:
  - [ ] `docs/architecture.md`가 새로운 인젝션 방식을 정확히 설명
  - [ ] `turn-end.md`가 system prompt 대신 messages.transform을 통해 인젝트된다고 명시
  - [ ] `<system-reminder>` 태그 래핑 설명 포함

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 문서가 새 인젝션 방식을 반영
    Tool: Bash (grep)
    Preconditions: docs/architecture.md 수정 완료
    Steps:
      1. `grep -c 'messages.transform\|messages transform\|synthetic.*user' docs/architecture.md`
      2. `grep -c 'system-reminder' docs/architecture.md`
    Expected Result: 각각 1 이상의 매치
    Failure Indicators: 0 매치 — 문서가 업데이트되지 않음
    Evidence: .sisyphus/evidence/task-2-docs-check.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-docs-check.txt — grep 결과

  **Commit**: YES
  - Message: `docs: update architecture doc for turn-end injection change`
  - Files: `docs/architecture.md`
  - Pre-commit: none

---

## Final Verification Wave

- [ ] F1. **Full Test Suite + Build + Lint** — `quick`
      `bun test` → 모든 테스트 통과. `mise run build` → 빌드 성공. `mise run lint` → 에러 없음.
      Output: `Tests [N pass/0 fail] | Build [PASS/FAIL] | Lint [PASS/FAIL] | VERDICT`

- [ ] F2. **Scope Fidelity Check** — `quick`
      `git diff`로 변경 파일 확인. 변경된 파일이 `src/index.ts`, `src/index.test.ts`, `docs/architecture.md`만인지 확인. turn-start 로직, knowledge index 로직, config 로직, scaffold 로직이 변경되지 않았는지 확인. 새로운 config 옵션이 추가되지 않았는지 확인.
      Output: `Files [N expected/N actual] | Scope [CLEAN/CONTAMINATED] | VERDICT`

---

## Commit Strategy

- **Task 1**: `refactor(prompt): move turn-end injection from system prompt to synthetic user message` — `src/index.ts`, `src/index.test.ts`
- **Task 2**: `docs: update architecture doc for turn-end injection change` — `docs/architecture.md`

---

## Success Criteria

### Verification Commands

```bash
bun test                # Expected: All tests pass (0 failures)
mise run build          # Expected: Build succeeds
mise run lint           # Expected: No errors
```

### Final Checklist

- [ ] turn-end가 system prompt에 포함되지 않음
- [ ] turn-end가 synthetic user message로 messages 배열 끝에 추가됨
- [ ] `<system-reminder>` 태그로 감싸져 있음
- [ ] TextPart에 `synthetic: true` 설정됨
- [ ] 빈 messages 배열 시 skip (크래시 없음)
- [ ] 빈 turn-end.md 시 skip (synthetic message 미생성)
- [ ] turn-start + knowledge index는 system prompt에 그대로 유지
- [ ] hot-reload 기능 유지
- [ ] 모든 테스트 통과
- [ ] 린트 에러 없음
- [ ] 빌드 성공
