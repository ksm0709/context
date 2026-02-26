# Prompt Injection Refactor: synthetic → real user messages

## TL;DR

> **Quick Summary**: turn-start/turn-end 프롬프트 주입을 `synthetic: true` 시스템 컨텍스트에서 실제 유저 메시지로 전환하여, AI가 액션 가능한 지시사항으로 처리하도록 변경
>
> **Deliverables**:
>
> - `src/index.ts` — 훅 로직 변경
> - `src/index.test.ts` — 테스트 업데이트
> - npm `@ksm0709/context` 새 버전 배포
> - `~/.opencode/node_modules` 로컬 업데이트
>
> **Estimated Effort**: Short
> **Parallel Execution**: NO — 순차 (소스 변경 → 테스트 → 빌드 → 배포)
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request

사용자가 synthetic 메시지 주입 방식의 한계를 발견:

- `synthetic: true` 파트는 OpenCode UI에 표시되지 않음
- AI가 soft context로 취급하여 도구 호출 등 실제 액션으로 이어지지 않음

요구사항: 모든 프롬프트를 `synthetic: false` (생략)로 유저 메시지처럼 취급:

- **turn-start** → 마지막 유저 메시지 parts에 append
- **turn-end** → 별도 유저 메시지로 push

### Interview Summary

**Key Discussions**:

- 배포 버전 불일치 발견 → v0.0.2 배포 완료
- `synthetic: true`의 두 가지 문제: UI 미표시 + AI 비액션
- system prompt vs synthetic message vs real user message 동작 차이 분석

**Research Findings**:

- `TextPart.synthetic?: boolean` — SDK 공식 필드, 생략 시 non-synthetic
- `messages.transform` 훅은 메시지 배열 in-place 변경 가능

### Metis Review

**Identified Gaps** (addressed):

- 빈 메시지/유저 메시지 없음 → 기존 early return 로직 유지
- synthetic 필드 처리 → 생략 방식 (omit, not explicit false)
- 스코프 크리프 방지 → config, scaffold, knowledge-index 변경 없음

---

## Work Objectives

### Core Objective

프롬프트 주입을 non-synthetic 유저 메시지로 전환하여 AI가 실제 지시사항으로 처리하도록 변경

### Concrete Deliverables

- `src/index.ts` 수정: system.transform에서 turn-start 제거, messages.transform에서 non-synthetic 주입
- `src/index.test.ts` 수정: 새 동작에 맞게 테스트 업데이트
- npm @ksm0709/context 새 버전 배포
- ~/.opencode 로컬 업데이트

### Definition of Done

- [x] `npx vitest run` — 전체 PASS
- [x] `npx eslint .` — 0 errors
- [x] 배포된 버전의 dist/index.js에 `synthetic` 문자열 없음
- [x] ~/.opencode/node_modules/@ksm0709/context 최신 버전 설치 확인

### Must Have

- turn-start가 마지막 유저 메시지 parts에 append (synthetic 없음)
- turn-end가 별도 유저 메시지로 push (synthetic 없음)
- system.transform에는 knowledge index만 남김
- hot-reload 유지 (매 호출 시 파일 읽기)
- 기존 엣지케이스 처리 유지 (빈 메시지, 유저 메시지 없음, 빈 파일)

### Must NOT Have (Guardrails)

- config 스키마 변경 금지
- scaffold 로직 변경 금지
- knowledge-index 로직 변경 금지
- 프롬프트 캐싱 추가 금지
- 새 의존성 추가 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after (기존 테스트 업데이트)
- **Framework**: vitest

### QA Policy

Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-*.{ext}`.

---

## Execution Strategy

### Sequential Execution

```
Task 1: src/index.ts 수정 + src/index.test.ts 업데이트 [deep]
Task 2: 빌드 + 테스트 + 린트 검증 [quick]
Task 3: 버전 범프 + npm 배포 + 로컬 업데이트 [quick]

Critical Path: Task 1 → Task 2 → Task 3
```

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | —          | 2, 3   |
| 2    | 1          | 3      |
| 3    | 2          | —      |

### Agent Dispatch Summary

- Task 1 → `deep` (핵심 로직 + 테스트 변경)
- Task 2 → `quick` (빌드/테스트/린트 실행)
- Task 3 → `quick` (npm publish + update)

---

## TODOs

- [x] 1. src/index.ts 훅 로직 변경 + 테스트 업데이트

  **What to do**:

  **A. `src/index.ts` — `experimental.chat.system.transform` 수정:**
  - turn-start 주입 코드 전체 제거 (turnStartPath, turnStart 변수, `output.system.push(turnStart)`)
  - knowledge index 로직만 남김:
    ```typescript
    'experimental.chat.system.transform': async (_input, output) => {
      const knowledgeSources = [config.knowledge.dir, ...config.knowledge.sources].filter(
        (s): s is string => Boolean(s)
      );
      const entries = buildKnowledgeIndex(directory, knowledgeSources);
      const indexContent = formatKnowledgeIndex(entries);
      if (indexContent) output.system.push(indexContent);
    },
    ```

  **B. `src/index.ts` — `experimental.chat.messages.transform` 전면 교체:**
  - 기존 turn-end 전용 로직을 turn-start + turn-end 통합 로직으로 변경
  - 구현 순서:
    1. early return: `if (output.messages.length === 0) return;`
    2. `lastUserMsg` 찾기: `output.messages.filter(m => m.info.role === 'user').at(-1)`
    3. early return: `if (!lastUserMsg) return;`
    4. **turn-start**: readPromptFile로 읽고, `lastUserMsg.parts.push({...})` — `synthetic` 필드 생략
       ```typescript
       lastUserMsg.parts.push({
         id: `context-turn-start-${Date.now()}`,
         sessionID: lastUserMsg.info.sessionID,
         messageID: lastUserMsg.info.id,
         type: 'text' as const,
         text: turnStart,
       });
       ```
    5. **turn-end**: readPromptFile로 읽고, `output.messages.push({...})` — `synthetic` 필드 생략
       ```typescript
       const msgId = `context-turn-end-${Date.now()}`;
       output.messages.push({
         info: {
           id: msgId,
           sessionID: lastUserMsg.info.sessionID,
           role: 'user' as const,
           time: { created: Date.now() },
           agent: (lastUserMsg.info as { role: 'user'; agent: string }).agent,
           model: (
             lastUserMsg.info as { role: 'user'; model: { providerID: string; modelID: string } }
           ).model,
         },
         parts: [
           {
             id: `context-turn-end-part-${Date.now()}`,
             sessionID: lastUserMsg.info.sessionID,
             messageID: msgId,
             type: 'text' as const,
             text: `<system-reminder>\n${turnEnd}\n</system-reminder>`,
           },
         ],
       });
       ```
  - 핵심 변경: `synthetic: true` 라인 완전 삭제, 필드 자체를 생략

  **C. `src/index.test.ts` — 테스트 업데이트:**
  - **수정할 테스트:**
    - `'injects turn-start content into output.system'` → `'appends turn-start to last user message parts'`로 변경. output.system 대신 output.messages의 마지막 유저 메시지 parts 확인
    - `'does NOT inject turn-end content into output.system'` → 삭제 또는 system.transform이 knowledge index만 주입하는지 확인하는 테스트로 교체
    - `'injects turn-end as synthetic user message'` → `synthetic: true` 어서션 제거. `expect(textPart.synthetic).toBe(true)` 라인 삭제
    - `'hot-reloads prompt file content on each hook call'` → system.transform 대신 messages.transform에서 turn-start hot-reload 테스트
  - **추가할 테스트:**
    - `'system.transform only injects knowledge index, not turn-start'` — system에 turn-start 내용 미포함 확인
    - `'turn-start part does not have synthetic flag'` — 주입된 파트에 `synthetic` 프로퍼티 없음 확인
    - `'turn-end message does not have synthetic flag'` — 주입된 메시지 파트에 `synthetic` 프로퍼티 없음 확인
  - **유지할 테스트 (변경 불필요):**
    - `'returns hooks object'`, `'scaffolds .opencode/context/'`, `'does not crash when prompt files are missing'`
    - `'skips turn-end injection when messages array is empty'`
    - `'skips turn-end injection when turn-end.md is empty'`
    - `'hot-reloads turn-end content in messages.transform'`
    - `'injects knowledge index when AGENTS.md exists'`

  **Must NOT do**:
  - config.ts, constants.ts, prompt-reader.ts, scaffold.ts, knowledge-index.ts 변경 금지
  - 테스트 프레임워크 변경 금지
  - 새 테스트 파일 생성 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 핵심 로직 + 테스트 동시 변경, 정확한 타입 매칭 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 1)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/index.ts:46-65` — 현재 system.transform 구현 (turn-start 제거 대상)
  - `src/index.ts:67-103` — 현재 messages.transform 구현 (전면 교체 대상)
  - `src/index.ts:77` — lastUserMsg 찾기 패턴 (재사용)
  - `src/index.ts:80-102` — turn-end 메시지 구조 (synthetic 필드만 제거)

  **API/Type References**:
  - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts:142-157` — TextPart 타입 (synthetic?: boolean 필드 위치)
  - `node_modules/@opencode-ai/plugin/dist/index.d.ts:191-196` — messages.transform 훅 시그니처
  - `node_modules/@opencode-ai/plugin/dist/index.d.ts:197-202` — system.transform 훅 시그니처

  **Test References**:
  - `src/index.test.ts:45-58` — turn-start 시스템 주입 테스트 (수정 대상)
  - `src/index.test.ts:60-72` — turn-end 시스템 미주입 테스트 (수정 대상)
  - `src/index.test.ts:127-160` — synthetic 메시지 주입 테스트 (synthetic 어서션 제거)
  - `src/index.test.ts:91-113` — hot-reload 테스트 (messages.transform으로 이동)

  **Acceptance Criteria**:
  - [ ] `npx vitest run` → 전체 PASS
  - [ ] system.transform이 knowledge index만 주입 (turn-start 미포함)
  - [ ] messages.transform이 turn-start를 마지막 유저 메시지 parts에 append
  - [ ] turn-start part에 `synthetic` 프로퍼티 없음
  - [ ] messages.transform이 turn-end를 별도 유저 메시지로 push
  - [ ] turn-end part에 `synthetic` 프로퍼티 없음
  - [ ] 빈 메시지 배열, 유저 메시지 없음, 빈 파일 등 엣지케이스 정상 처리

  **QA Scenarios:**

  ```
  Scenario: turn-start가 유저 메시지에 append됨
    Tool: Bash (npx vitest run)
    Preconditions: src/index.test.ts에 해당 테스트 존재
    Steps:
      1. npx vitest run src/index.test.ts
      2. 'appends turn-start to last user message parts' 테스트 결과 확인
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-1-turn-start-append.txt

  Scenario: turn-end 메시지에 synthetic 필드 없음
    Tool: Bash (grep)
    Preconditions: src/index.ts 수정 완료
    Steps:
      1. grep -n 'synthetic' src/index.ts
    Expected Result: 0 matches (synthetic 문자열 완전 제거)
    Evidence: .sisyphus/evidence/task-1-no-synthetic.txt

  Scenario: 엣지케이스 — 빈 메시지 배열에서 크래시 없음
    Tool: Bash (npx vitest run)
    Steps:
      1. npx vitest run src/index.test.ts --reporter=verbose
      2. 'skips turn-end injection when messages array is empty' 결과 확인
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-1-edge-cases.txt
  ```

  **Commit**: YES
  - Message: `feat: switch prompt injection from synthetic to real user messages`
  - Files: `src/index.ts`, `src/index.test.ts`
  - Pre-commit: `npx vitest run && npx eslint .`

---

- [x] 2. 빌드 + 전체 검증

  **What to do**:
  - `PATH="$HOME/.bun/bin:$PATH" bun build ./src/index.ts --outdir dist --target bun` 실행
  - `npx vitest run` — 전체 41+ 테스트 PASS 확인
  - `npx eslint .` — 0 errors 확인
  - dist/index.js에서 `synthetic` 문자열 검색 → 0 matches 확인

  **Must NOT do**:
  - 소스 코드 수정 금지 (빌드/검증만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `mise.toml` — 빌드 도구 설정 (bun 1.3.2, 단 로컬은 ~/.bun/bin/bun 사용)
  - `package.json:2-3` — 패키지명, 현재 버전
  - `eslint.config.js` — 린트 설정

  **Acceptance Criteria**:
  - [ ] `bun build` 성공, dist/index.js 생성
  - [ ] `npx vitest run` → 전체 PASS
  - [ ] `npx eslint .` → 0 errors
  - [ ] `grep 'synthetic' dist/index.js` → 0 matches

  **QA Scenarios:**

  ```
  Scenario: 빌드 결과물에 synthetic 없음
    Tool: Bash
    Steps:
      1. PATH="$HOME/.bun/bin:$PATH" bun build ./src/index.ts --outdir dist --target bun
      2. grep -c 'synthetic' dist/index.js
    Expected Result: 빌드 성공, grep 결과 0
    Evidence: .sisyphus/evidence/task-2-build-verify.txt

  Scenario: 전체 테스트 통과
    Tool: Bash
    Steps:
      1. npx vitest run 2>&1
    Expected Result: "Tests X passed (X)" with 0 failures
    Evidence: .sisyphus/evidence/task-2-test-results.txt
  ```

  **Commit**: NO (빌드 산출물은 gitignore)

---

- [x] 3. 버전 범프 + npm 배포 + 로컬 업데이트

  **What to do**:
  - `npm version patch --no-git-tag-version` (0.0.2 → 0.0.3)
  - `npm publish`
  - `npm install @ksm0709/context@latest` in `~/.opencode/`
  - 설치된 버전 확인: `cat ~/.opencode/node_modules/@ksm0709/context/package.json | grep version`
  - 배포된 dist에 `synthetic` 없음 재확인: `grep 'synthetic' ~/.opencode/node_modules/@ksm0709/context/dist/index.js`

  **Must NOT do**:
  - git tag 생성 금지 (release-please 워크플로 충돌 방지)
  - git push 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: —
  - **Blocked By**: Task 2

  **References**:
  - `package.json:3` — 현재 버전 (0.0.2)
  - `~/.opencode/package.json` — `"@ksm0709/context": "latest"` (이미 설정됨)
  - `RELEASE.md:28-39` — 수동 배포 절차 참고

  **Acceptance Criteria**:
  - [ ] npm publish 성공
  - [ ] `~/.opencode/node_modules/@ksm0709/context` 버전 = 0.0.3
  - [ ] 배포된 dist/index.js에 `synthetic` 없음

  **QA Scenarios:**

  ```
  Scenario: 배포 및 로컬 업데이트 성공
    Tool: Bash
    Steps:
      1. npm version patch --no-git-tag-version
      2. npm publish
      3. cd ~/.opencode && npm install @ksm0709/context@latest
      4. cat ~/.opencode/node_modules/@ksm0709/context/package.json | grep version
      5. grep -c 'synthetic' ~/.opencode/node_modules/@ksm0709/context/dist/index.js
    Expected Result: version "0.0.3", grep 결과 0
    Evidence: .sisyphus/evidence/task-3-deploy-verify.txt

  Scenario: 배포 실패 시 — 버전 충돌
    Tool: Bash
    Preconditions: npm publish가 E403 반환
    Steps:
      1. npm view @ksm0709/context versions --json
      2. 다음 가용 버전으로 npm version 재실행
    Expected Result: 충돌 없는 버전으로 재배포 성공
    Evidence: .sisyphus/evidence/task-3-version-conflict.txt
  ```

  **Commit**: YES
  - Message: `chore: bump version to 0.0.3`
  - Files: `package.json`
  - Pre-commit: none

---

## Final Verification Wave

> 이 작업은 소규모(3 task)이므로 별도 Final Verification Wave 생략.
> Task 2의 빌드/테스트/린트 검증이 Final Verification 역할 수행.

---

## Commit Strategy

| Task | Commit Message                                                       | Files                               |
| ---- | -------------------------------------------------------------------- | ----------------------------------- |
| 1    | `feat: switch prompt injection from synthetic to real user messages` | `src/index.ts`, `src/index.test.ts` |
| 3    | `chore: bump version to 0.0.3`                                       | `package.json`                      |

---

## Success Criteria

### Verification Commands

```bash
npx vitest run                    # Expected: all tests PASS
npx eslint .                      # Expected: 0 errors
grep 'synthetic' src/index.ts     # Expected: 0 matches
grep 'synthetic' dist/index.js    # Expected: 0 matches
```

### Final Checklist

- [x] system.transform에 knowledge index만 존재
- [x] turn-start가 유저 메시지 parts에 append됨
- [x] turn-end가 별도 유저 메시지로 push됨
- [x] synthetic 필드 완전 제거
- [x] npm 배포 완료
- [x] 로컬 ~/.opencode 업데이트 완료
