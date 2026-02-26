# Knowledge Index Relocation: system.transform → messages.transform

## TL;DR

> **Quick Summary**: Knowledge index 주입 위치를 system.transform(시스템 프롬프트)에서 messages.transform(유저 메시지)으로 이동하여 turn-start와 결합. "아래 Available Knowledge" 참조가 실제로 아래에 위치하도록 수정.
>
> **Deliverables**:
>
> - `src/index.ts` — system.transform 훅 제거, knowledge index를 messages.transform에서 turn-start와 결합
> - `src/index.test.ts` — 테스트 업데이트 (system.transform 관련 → messages.transform 기반으로 변경)
> - npm `@ksm0709/context` 새 버전 배포
> - `~/.config/opencode` 로컬 업데이트
>
> **Estimated Effort**: Quick
> **Parallel Execution**: NO — 순차 (소스 변경 → 검증 → 배포)
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request

prompt-injection-refactor에서 turn-start를 system.transform → messages.transform으로 이동했으나, knowledge index는 system.transform에 그대로 남겨둠. 결과적으로 turn-start가 "아래 Available Knowledge 목록에서..."라고 안내하지만, Available Knowledge는 시스템 프롬프트(다른 위치)에 있어 공간적 참조가 깨짐.

### Root Cause

```
Before refactor (v0.0.2):
  system.transform: turn-start → Available Knowledge (연속, "아래" 정확)

After refactor (v0.0.3~0.0.4, 현재):
  system.transform: Available Knowledge (홀로)
  messages.transform: turn-start ("아래" 가리킬 대상 없음) + turn-end
```

---

## Work Objectives

### Core Objective

Knowledge index를 turn-start와 같은 위치(유저 메시지)에 결합하여 "아래 Available Knowledge" 참조를 정상화

### Concrete Deliverables

- `src/index.ts` 수정 (system.transform 제거, messages.transform에서 turn-start + knowledge index 결합)
- `src/index.test.ts` 수정 (system.transform 관련 테스트 → messages.transform 기반으로 변경)

### Must Have

- system.transform 훅 완전 제거
- knowledge index가 turn-start 텍스트 바로 뒤에 `\n\n`으로 결합되어 유저 메시지 part로 주입
- turn-start만 있고 knowledge 없으면 turn-start만 주입
- knowledge만 있고 turn-start 없으면 knowledge만 주입
- 둘 다 없으면 part 추가 안 함
- turn-end 로직 변경 없음
- 모든 기존 테스트 통과 (수정된 형태로)

### Must NOT Have (Guardrails)

- ❌ config.ts, constants.ts, scaffold.ts, knowledge-index.ts, prompt-reader.ts 변경
- ❌ turn-end 주입 로직 변경
- ❌ knowledge index 빌드 로직 자체 변경 (호출 위치만 이동)
- ❌ console.log 사용
- ❌ src/index.ts에서 함수/상수 named export

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after (기존 테스트 업데이트)
- **Framework**: vitest

---

## Execution Strategy

### Sequential Execution

```
Task 1: src/index.ts + src/index.test.ts 수정 [deep]
Task 2: 빌드 + 테스트 + 린트 검증 + 커밋 + 푸시 [quick]
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
- Task 2 → `quick` (빌드/테스트/린트/커밋)
- Task 3 → `quick` (npm publish + update)

---

## TODOs

- [ ] 1. src/index.ts 훅 로직 변경 + 테스트 업데이트

  **What to do**:

  **A. `src/index.ts` — `experimental.chat.system.transform` 훅 제거:**
  - lines 46-56 전체 삭제 (system.transform 훅 블록 + 빈 줄)

  **B. `src/index.ts` — `experimental.chat.messages.transform` 수정:**
  - 기존 turn-start 주입 블록(lines 64-78)을 아래로 교체:

  ```typescript
  // 3. turn-start + knowledge index: combine and append to last user message (hot-reload)
  const turnStartPath = join(
    directory,
    config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile)
  );
  const turnStart = readPromptFile(turnStartPath);

  const knowledgeSources = [config.knowledge.dir, ...config.knowledge.sources].filter(
    (s): s is string => Boolean(s)
  );
  const entries = buildKnowledgeIndex(directory, knowledgeSources);
  const indexContent = formatKnowledgeIndex(entries);

  const combinedContent = [turnStart, indexContent].filter(Boolean).join('\n\n');
  if (combinedContent) {
    lastUserMsg.parts.push({
      id: `context-turn-start-${Date.now()}`,
      sessionID: lastUserMsg.info.sessionID,
      messageID: lastUserMsg.info.id,
      type: 'text' as const,
      text: combinedContent,
    });
  }
  ```

  - turn-end 로직 (lines 80-109) 은 **완전히 그대로 유지**

  **C. `src/index.test.ts` — 테스트 업데이트:**

  **수정할 테스트:**
  1. `'returns hooks object with experimental.chat.system.transform and messages.transform'` (line 33):
     - `expect(hooks['experimental.chat.system.transform']).toBeDefined()` 라인을 삭제
     - 테스트 제목을 `'returns hooks object with messages.transform'`로 변경

  2. `'system.transform does not inject turn-start or turn-end'` (lines 75-88):
     - **전체 삭제** — system.transform 훅이 없으므로 의미 없음

  3. `'does not crash when prompt files are missing'` (lines 90-105):
     - system.transform 대신 messages.transform을 테스트하도록 변경
     - output 구조를 `{ system: [] }` → `{ messages: [userMsg] }` 로 변경
     - 호출을 `hooks['experimental.chat.messages.transform']`으로 변경

  4. `'injects knowledge index when AGENTS.md exists'` (lines 144-154):
     - system.transform 대신 messages.transform을 테스트
     - output을 messages 배열 구조로 변경
     - AGENTS.md 외에 turn-start.md도 생성 (빈 파일이라도)
     - 검증: 마지막 유저 메시지의 마지막 part text에 'AGENTS.md' 포함 확인

  **추가할 테스트:**
  5. `'combines turn-start and knowledge index in one text part'`:
     - turn-start.md에 'TURN START' 작성
     - AGENTS.md 생성
     - messages.transform 호출
     - 마지막 유저 메시지의 part.text에 'TURN START'와 'AGENTS.md' 모두 포함 확인

  6. `'injects only knowledge index when turn-start.md is empty'`:
     - turn-start.md를 빈 파일로
     - AGENTS.md 생성
     - part.text에 'AGENTS.md' 포함, 'Available Knowledge' 포함 확인

  **유지할 테스트 (변경 불필요):**
  - `'scaffolds .opencode/context/ on first run'`
  - `'appends turn-start to last user message parts via messages.transform'` — turn-start 포함 확인은 여전히 유효
  - `'hot-reloads turn-start content via messages.transform'`
  - `'injects turn-end as real user message via messages.transform'`
  - `'skips turn-end injection when messages array is empty'`
  - `'skips turn-end injection when turn-end.md is empty'`
  - `'hot-reloads turn-end content in messages.transform'`
  - `'turn-start part does not have synthetic flag'`
  - `'turn-end message does not have synthetic flag'`

  **Must NOT do**:
  - config.ts, constants.ts, prompt-reader.ts, scaffold.ts, knowledge-index.ts 변경 금지
  - turn-end 주입 로직 변경 금지
  - console.log 사용 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 핵심 로직 변경 + 다수 테스트 수정/추가. 정확한 코드 이해 필요.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 1)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/index.ts:46-56` — 현재 system.transform 훅 (삭제 대상)
  - `src/index.ts:58-78` — 현재 messages.transform의 turn-start 블록 (수정 대상)
  - `src/index.ts:80-110` — 현재 messages.transform의 turn-end 블록 (유지)
  - `src/lib/knowledge-index.ts:44-65` — buildKnowledgeIndex 함수 (호출만, 수정 금지)
  - `src/lib/knowledge-index.ts:67-74` — formatKnowledgeIndex 함수 (호출만, 수정 금지)

  **Test References**:
  - `src/index.test.ts:33-38` — hooks 객체 테스트 (수정)
  - `src/index.test.ts:75-88` — system.transform 동작 테스트 (삭제)
  - `src/index.test.ts:90-105` — 파일 없을 때 크래시 방지 테스트 (수정)
  - `src/index.test.ts:144-154` — knowledge index 주입 테스트 (수정)

  **Acceptance Criteria**:
  - [ ] `src/index.ts`에 `experimental.chat.system.transform` 없음
  - [ ] `src/index.ts`에서 knowledge index가 turn-start와 `\n\n`으로 결합되어 유저 메시지 part로 주입
  - [ ] `bun test src/index.test.ts` → PASS (모든 테스트)
  - [ ] turn-end 로직 변경 없음 확인

  **QA Scenarios:**

  ```
  Scenario: knowledge index가 turn-start와 결합되어 유저 메시지에 주입
    Tool: Bash (bun test)
    Preconditions: 수정 완료
    Steps:
      1. bun test src/index.test.ts
      2. 'combines turn-start and knowledge index' 테스트 결과 확인
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-1-combined-injection.txt

  Scenario: system.transform 훅 완전 제거 확인
    Tool: Bash (grep)
    Steps:
      1. grep -n 'system.transform' src/index.ts
    Expected Result: 0 matches
    Evidence: .sisyphus/evidence/task-1-no-system-transform.txt

  Scenario: turn-end 로직 변경 없음 확인
    Tool: Bash (bun test)
    Steps:
      1. bun test src/index.test.ts --reporter=verbose
      2. turn-end 관련 테스트 전부 PASS 확인
    Expected Result: turn-end 테스트 4개 모두 PASS
    Evidence: .sisyphus/evidence/task-1-turn-end-intact.txt
  ```

  **Commit**: YES
  - Message: `fix: move knowledge index from system prompt to user message alongside turn-start`
  - Files: `src/index.ts, src/index.test.ts`
  - Pre-commit: `bun test && mise run lint`

---

- [ ] 2. 빌드 + 전체 검증 + 커밋 + 푸시

  **What to do**:
  - `bun test` — 전체 테스트 PASS 확인
  - `mise run lint` — 0 errors 확인
  - `bun build ./src/index.ts --outdir dist --target bun` — 빌드 성공 확인
  - `grep -c 'system.transform' dist/index.js` — 0 확인
  - Task 1 커밋이 안 되어 있으면 커밋:
    - `git add src/index.ts src/index.test.ts`
    - `git commit -m "fix: move knowledge index from system prompt to user message alongside turn-start"`
  - `git push origin HEAD`

  **Must NOT do**:
  - 소스 코드 수정 금지 (검증만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `mise.toml` — 빌드/린트 명령어
  - `package.json` — 현재 버전

  **Acceptance Criteria**:
  - [ ] `bun test` → 전체 PASS
  - [ ] `mise run lint` → 0 errors
  - [ ] `bun build` 성공
  - [ ] `grep -c 'system.transform' dist/index.js` → 0
  - [ ] git push 성공

  **QA Scenarios:**

  ```
  Scenario: 빌드 결과물에 system.transform 없음
    Tool: Bash
    Steps:
      1. bun build ./src/index.ts --outdir dist --target bun
      2. grep -c 'system.transform' dist/index.js
    Expected Result: 빌드 성공, grep 결과 0
    Evidence: .sisyphus/evidence/task-2-build-verify.txt
  ```

  **Commit**: YES (Task 1 커밋 포함)
  - Message: `fix: move knowledge index from system prompt to user message alongside turn-start`
  - Files: `src/index.ts, src/index.test.ts`
  - Pre-commit: `bun test && mise run lint`

---

- [ ] 3. 버전 범프 + npm 배포 + 로컬 업데이트

  **What to do**:
  - `npm version patch --no-git-tag-version` — 0.0.4 → 0.0.5
  - `bun build ./src/index.ts --outdir dist --target bun` — 빌드
  - `npm publish` — npm 배포
  - `cd ~/.config/opencode && npm install @ksm0709/context@latest` — 로컬 업데이트
  - 검증:
    - `cat ~/.config/opencode/node_modules/@ksm0709/context/package.json | grep version` → 0.0.5
    - `grep -c 'system.transform' ~/.config/opencode/node_modules/@ksm0709/context/dist/index.js` → 0
  - 커밋 + 푸시:
    - `git add package.json && git commit -m "chore: bump version to 0.0.5" && git push origin HEAD`

  **Must NOT do**:
  - git tag 생성 금지 (`--no-git-tag-version` 필수)
  - src/ 코드 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: —
  - **Blocked By**: Task 2

  **References**:
  - `package.json:3` — 현재 버전 (0.0.4)
  - `~/.config/opencode/package.json` — 로컬 설치 위치
  - `RELEASE.md` — 배포 절차 참고

  **Acceptance Criteria**:
  - [ ] npm publish 성공
  - [ ] `~/.config/opencode/node_modules/@ksm0709/context` 버전 = 0.0.5
  - [ ] 배포된 dist/index.js에 `system.transform` 없음
  - [ ] git push 성공

  **QA Scenarios:**

  ```
  Scenario: 배포 및 로컬 업데이트 성공
    Tool: Bash
    Steps:
      1. npm version patch --no-git-tag-version
      2. bun build ./src/index.ts --outdir dist --target bun
      3. npm publish
      4. cd ~/.config/opencode && npm install @ksm0709/context@latest
      5. cat ~/.config/opencode/node_modules/@ksm0709/context/package.json | grep version
      6. grep -c 'system.transform' ~/.config/opencode/node_modules/@ksm0709/context/dist/index.js
    Expected Result: version "0.0.5", grep 결과 0
    Evidence: .sisyphus/evidence/task-3-deploy-verify.txt
  ```

  **Commit**: YES
  - Message: `chore: bump version to 0.0.5`
  - Files: `package.json`
  - Pre-commit: none

---

## Final Verification Wave

> 이 작업은 소규모(3 task)이므로 별도 Final Verification Wave 생략.
> Task 2의 빌드/테스트/린트 검증이 Final Verification 역할 수행.

---

## Commit Strategy

| Task | Commit Message                                                                      | Files                               |
| ---- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| 1+2  | `fix: move knowledge index from system prompt to user message alongside turn-start` | `src/index.ts`, `src/index.test.ts` |
| 3    | `chore: bump version to 0.0.5`                                                      | `package.json`                      |

---

## Success Criteria

### Verification Commands

```bash
bun test                            # Expected: all tests PASS
mise run lint                       # Expected: 0 errors
bun build ./src/index.ts --outdir dist --target bun  # Expected: success
grep 'system.transform' src/index.ts  # Expected: 0 matches
```

### Final Checklist

- [ ] system.transform 훅 완전 제거
- [ ] knowledge index가 turn-start와 결합되어 유저 메시지에 주입
- [ ] turn-end 로직 변경 없음
- [ ] 모든 테스트 통과
- [ ] npm 배포 완료
- [ ] 로컬 ~/.config/opencode 업데이트 완료
