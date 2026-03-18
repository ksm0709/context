# OMX (oh-my-codex) 호환성 추가

## TL;DR

> **Quick Summary**: 현재 OpenCode 전용인 `@ksm0709/context` 플러그인을 oh-my-codex(OMX)에서도 사용 가능하게 확장. 설정 디렉토리를 플랫폼 중립 `.context/`로 이전하고, OMX용 엔트리포인트를 추가하여 AGENTS.md에 knowledge index를 자동 주입하는 마커 시스템을 구현.
>
> **Deliverables**:
>
> - `src/omx/index.ts` — OMX 플러그인 엔트리포인트 (`onHookEvent` export)
> - `src/omx/agents-md.ts` — AGENTS.md 마커 기반 주입 모듈
> - `src/lib/context-dir.ts` — 플랫폼 중립 디렉토리 해석 유틸리티
> - `.context/` 기반 스캐폴드 + `.opencode/context/` fallback
> - `package.json` 멀티 엔트리 (`./omx` export + `.mjs` 빌드)
> - CLI `context migrate` 커맨드
> - CLI `context install omx` 커맨드 (`.omx/hooks/`에 플러그인 파일 자동 배치)
> - 문서 업데이트 (architecture.md, 신규 docs)
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 5 → Task 7 → Task 8 → Task 10 → Task 12 → Task 13 → F1-F4

---

## Context

### Original Request

이 플러그인을 oh-my-codex(omx) 플러그인으로도 사용 가능하게 업데이트.

### Interview Summary

**Key Discussions**:

- **프롬프트 주입 방식**: OMX에는 `experimental.chat.messages.transform` 대응 API가 없음. AGENTS.md를 자동 관리하여 knowledge index + turn-start를 주입하기로 결정
- **패키지 구조**: 단일 패키지 + 멀티 엔트리 (`./opencode`, `./omx`)
- **설정 디렉토리**: `.context/` 플랫폼 중립. 기존 `.opencode/context/` fallback 지원
- **AGENTS.md 주입 범위**: 제텔카스텐 가이드 + Knowledge index + turn-start. Turn-end는 `turn-complete` 훅 활용 가능성 검토만 (구현 제외)
- **마이그레이션**: Fallback 인식 + CLI `migrate` 커맨드
- **테스트**: TDD (RED-GREEN-REFACTOR)

**Research Findings**:

- OMX 플러그인은 `.omx/hooks/*.mjs` 파일로 배포, `export async function onHookEvent(event, sdk)` 계약
- OMX SDK: `sdk.tmux.sendKeys()`, `sdk.log.info|warn|error()`, `sdk.state.read|write|delete|all()`
- OMX 이벤트: `session-start`, `session-end`, `turn-complete`, `session-idle` + derived signals
- 현재 코어 모듈 (`knowledge-index.ts`, `prompt-reader.ts`, `config.ts`, `scaffold.ts`)은 플랫폼 독립적이며 재사용 가능
- `package.json`에 자기참조 의존성 버그 (`"@ksm0709/context": "^0.0.18"`) 발견 → 수정 필요

### Metis Review

**Identified Gaps** (addressed):

- `DEFAULT_CONFIG` 문자열 리터럴이 `.opencode/context/prompts/...`를 하드코딩 → `.context/` 스캐폴드에서는 상대 경로 사용
- `.version` 파일 경로가 하드코딩 → `resolveContextDir()` 유틸리티로 해결
- 빌드 타겟 차이 (Bun-specific vs standard ESM) → OMX 빌드는 `--target node`로 분리
- Config fallback 우선순위 미정의 → `.context/` > `.opencode/context/` 명시
- AGENTS.md 동시 쓰기 race condition → atomic write (temp + rename) 적용
- 자기참조 의존성 버그 → Commit 1에서 제거
- `scaffold.ts`의 `DEFAULT_TURN_END`가 `.opencode/context/templates/` 링크 포함 → `.context/` 스캐폴드에서만 새 경로 적용

---

## Work Objectives

### Core Objective

`@ksm0709/context` 플러그인을 OpenCode와 OMX 양 플랫폼에서 동일한 코어 모듈을 공유하며 동작하도록 확장한다.

### Concrete Deliverables

- `src/lib/context-dir.ts` — `resolveContextDir(projectDir)` 유틸리티
- `src/omx/index.ts` — OMX 플러그인 엔트리포인트
- `src/omx/agents-md.ts` — AGENTS.md 마커 기반 주입/갱신 모듈
- `src/cli/commands/migrate.ts` — `.opencode/context/` → `.context/` 마이그레이션 CLI
- `src/cli/commands/install.ts` — `context install omx` — `.omx/hooks/`에 OMX 플러그인 파일 자동 배치
- `package.json` — `"./omx"` export 추가 + OMX 빌드 스크립트
- `docs/architecture.md` 업데이트 + `docs/adr-003-omx-compatibility.md` + `docs/decision-omx-turn-end-investigation.md`

### Definition of Done

- [ ] `npx vitest run` — 전체 테스트 통과 (기존 + 신규)
- [ ] `mise run build` — OpenCode + OMX 빌드 모두 성공
- [ ] `node --input-type=module -e "import('./dist/omx/index.mjs').then(m => { if (typeof m.onHookEvent !== 'function') process.exit(1) })"` — OMX 빌드 ESM 호환 확인
- [ ] 기존 OpenCode 테스트 100% 통과 (하위호환)

### Must Have

- OMX `session-start` 이벤트에서 AGENTS.md에 knowledge index + turn-start 자동 주입
- AGENTS.md 마커 시스템 (`<!-- context:start -->` / `<!-- context:end -->`) 기반 멱등 주입
- `.context/` 우선, `.opencode/context/` fallback 디렉토리 해석
- 단일 `@ksm0709/context` 패키지에서 `./omx` 엔트리 export
- OMX 빌드 결과물이 표준 ESM `.mjs` (Bun-specific API 없음)
- CLI `context migrate` 커맨드
- 기존 OpenCode 기능 100% 하위호환

### Must NOT Have (Guardrails)

- **G1**: `src/index.ts` (OpenCode 엔트리) 동작 변경 금지 — 이 파일은 이번 작업에서 동결
- **G2**: `package.json`의 `"."` export 변경 금지 — 기존 OpenCode 경로 유지
- **G3**: 공유 코어 모듈에 `Bun.*` API 사용 금지 — `node:fs`, `node:path`만 사용
- **G4**: OMX turn-end 구현 금지 — 조사 노트만 작성
- **G5**: OMX derived signals (`needs-input`, `pre-tool-use`, `post-tool-use`) 구현 금지
- **G6**: OMX team-worker 모드 지원 금지
- **G7**: 기존 사용자의 `DEFAULT_CONFIG`/프롬프트 파일 덮어쓰기 금지
- **G8**: CLI migrate에서 `git mv` 등 git 연산 금지 — plain filesystem만
- **G9**: 불필요한 추상화/adapter 패턴 도입 금지 — 각 플랫폼 엔트리포인트가 코어를 직접 호출
- **G10**: AI slop — 과도한 주석, 불필요한 JSDoc, 사용하지 않는 에러 핸들링 금지

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: vitest (`npx vitest run`)
- **Each task follows**: 테스트 먼저 작성 → 구현하여 통과 → 리팩토링

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Module/Library**: Use Bash (`node` REPL or `npx vitest run {file}`) — import, call functions, compare output
- **CLI**: Use Bash — run command, validate stdout/stderr/exit code
- **Build**: Use Bash — `mise run build` + `node --input-type=module` import 검증

### Test Rules (from AGENTS.md)

- 테스트는 프로젝트와 격리된 시스템 임시 디렉토리에서 수행 (`os.tmpdir()` + unique suffix)
- `node:fs` mock 금지 — 실제 temp 디렉토리 사용
- `bun test` 사용 금지 — `npx vitest run` 사용 (gotcha: [[docs/gotcha-bun-test-vitest-api-incompatibility.md]])
- ESM 모킹 시 `vi.mock` 사용 (gotcha: [[docs/pattern-bun-vitest-esm-mocking.md]])

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 기반 정리 + 독립 모듈):
├── Task 1: package.json 자기참조 의존성 수정 [quick]
├── Task 2: resolveContextDir() 유틸리티 TDD [deep]
├── Task 3: AGENTS.md 마커 시스템 TDD [deep]
└── Task 4: ADR-003 + decision 문서 작성 [writing]

Wave 2 (After Wave 1 — 코어 리팩토링):
├── Task 5: constants.ts .context/ 경로 이전 + scaffold.ts 리팩토링 [deep]
├── Task 6: config.ts fallback 로직 적용 [unspecified-high]
└── Task 7: DEFAULT_CONFIG/DEFAULT_TURN_START/DEFAULT_TURN_END 경로 갱신 [unspecified-high]

Wave 3 (After Wave 2 — OMX + CLI + 빌드):
├── Task 8: OMX 엔트리포인트 TDD [deep]
├── Task 9: CLI migrate 커맨드 TDD [unspecified-high]
├── Task 10: 멀티 엔트리 package.json + OMX 빌드 [quick]
└── Task 11: OpenCode 엔트리포인트 .context/ fallback 적용 [unspecified-high]

Wave 4 (After Wave 3 — CLI install + 문서):
├── Task 12: CLI install omx 커맨드 TDD [unspecified-high]
└── Task 13: architecture.md + docs 업데이트 [writing]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On          | Blocks            | Wave |
| ---- | ------------------- | ----------------- | ---- |
| 1    | —                   | 5, 6, 7, 10       | 1    |
| 2    | —                   | 5, 6, 7, 8, 9, 11 | 1    |
| 3    | —                   | 8                 | 1    |
| 4    | —                   | 13                | 1    |
| 5    | 1, 2                | 7, 8, 9, 11       | 2    |
| 6    | 1, 2                | 8, 9, 11          | 2    |
| 7    | 5                   | 8, 11             | 2    |
| 8    | 2, 3, 5, 6, 7       | 10, 12, 13        | 3    |
| 9    | 2, 5, 6             | 13                | 3    |
| 10   | 1, 8                | 12, 13            | 3    |
| 11   | 2, 5, 6, 7          | 13                | 3    |
| 12   | 8, 10               | 13                | 4    |
| 13   | 4, 8, 9, 10, 11, 12 | F1-F4             | 4    |

### Agent Dispatch Summary

- **Wave 1**: **4 tasks** — T1 → `quick`, T2 → `deep`, T3 → `deep`, T4 → `writing`
- **Wave 2**: **3 tasks** — T5 → `deep`, T6 → `unspecified-high`, T7 → `unspecified-high`
- **Wave 3**: **4 tasks** — T8 → `deep`, T9 → `unspecified-high`, T10 → `quick`, T11 → `unspecified-high`
- **Wave 4**: **2 tasks** — T12 → `unspecified-high`, T13 → `writing`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. package.json 자기참조 의존성 수정

  **What to do**:
  - `package.json`의 `dependencies`에서 `"@ksm0709/context": "^0.0.18"` 제거
  - 이는 자기 자신을 의존하는 버그로, npm install 시 순환 참조를 유발함
  - `dependencies` 키에 다른 의존성(`jsonc-parser`)만 남김

  **Must NOT do**:
  - `peerDependencies` 또는 `devDependencies` 수정 금지
  - 다른 package.json 필드 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일 1줄 변경
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-dev`: 이 태스크는 플러그인 API와 무관한 단순 수정

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 10
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - (없음 — 단순 삭제)

  **API/Type References**:
  - (없음)

  **External References**:
  - npm docs: self-referential dependencies are invalid and may cause install loops

  **WHY Each Reference Matters**:
  - `package.json:40` — 여기에 있는 `"@ksm0709/context": "^0.0.18"`를 삭제해야 함

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: dependencies에서 자기참조 제거됨
    Tool: Bash (node)
    Preconditions: package.json 수정 완료
    Steps:
      1. node -e "const p = require('./package.json'); if (p.dependencies['@ksm0709/context']) process.exit(1)"
      2. node -e "const p = require('./package.json'); if (!p.dependencies['jsonc-parser']) process.exit(1)"
    Expected Result: 두 명령 모두 exit 0
    Failure Indicators: exit code 1 — 자기참조가 남아있거나 jsonc-parser가 삭제됨
    Evidence: .sisyphus/evidence/task-1-self-ref-removed.txt
  ```

  **Commit**: YES
  - Message: `fix(deps): remove self-referential dependency from package.json`
  - Files: `package.json`
  - Pre-commit: `node -e "const p=require('./package.json'); if(p.dependencies['@ksm0709/context']) process.exit(1)"`

- [x] 2. resolveContextDir() 유틸리티 TDD

  **What to do**:
  - `src/lib/context-dir.ts` 생성 — `resolveContextDir(projectDir: string): string` 함수
  - 로직: `.context/` 디렉토리 존재 확인 → 있으면 반환, 없으면 `.opencode/context/` 존재 확인 → 있으면 반환, 둘 다 없으면 `.context/` 반환 (새 기본값)
  - `src/lib/context-dir.test.ts` 생성 — TDD로 4가지 케이스 커버:
    1. `.context/`만 존재 → `.context/` 반환
    2. `.opencode/context/`만 존재 → `.opencode/context/` 반환
    3. 둘 다 존재 → `.context/` 반환 (우선순위)
    4. 둘 다 없음 → `.context/` 반환 (기본값)
  - 테스트는 실제 `os.tmpdir()` + unique suffix 사용 (no fs mocking)

  **Must NOT do**:
  - `Bun.*` API 사용 금지 — `node:fs`, `node:path`만 사용
  - 기존 파일 수정 금지 — 이 태스크는 새 파일만 생성

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: TDD 워크플로우 + 새 유틸리티 설계. 테스트 4가지 케이스 커버리지 필요
  - **Skills**: [`bear-python-pro`]
    - `bear-python-pro`: TDD 패턴 (여기서는 TS지만 TDD 원칙 공유). 아니면 스킬 없이도 가능
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-dev`: 플랫폼 독립 유틸리티이므로 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 11
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/config.ts:37-49` — `loadConfig()`의 try/catch graceful fallback 패턴. `resolveContextDir`도 동일하게 에러 시 기본값 반환해야 함
  - `src/lib/scaffold.ts:319-326` — `scaffoldIfNeeded()`의 `existsSync()` 기반 멱등성 체크 패턴. `resolveContextDir`도 `existsSync`로 디렉토리 존재 확인
  - `src/lib/scaffold.test.ts` — 기존 테스트가 `os.tmpdir()` + 고유 디렉토리로 격리하는 패턴. 동일하게 따라야 함

  **API/Type References**:
  - `src/constants.ts:1-11` — 현재 DEFAULTS에 정의된 경로들. `resolveContextDir`이 반환하는 값은 이 경로들의 base directory가 됨

  **Test References**:
  - `src/lib/scaffold.test.ts` — vitest describe/it 구조, tmpdir 패턴, afterEach cleanup 패턴
  - `src/lib/config.test.ts` — config 로드 테스트의 에러 핸들링 패턴

  **External References**:
  - [[docs/pattern-bun-vitest-esm-mocking.md]] — ESM 모듈 테스트 시 주의점 (여기서는 mocking 불필요하지만 참고)
  - [[docs/gotcha-bun-test-vitest-api-incompatibility.md]] — `bun test` 대신 `npx vitest run` 사용 필수

  **WHY Each Reference Matters**:
  - `config.ts:37-49` — 에러 핸들링 패턴을 따라 `existsSync` 호출 실패 시에도 기본값 반환
  - `scaffold.ts:319-326` — 디렉토리 존재 체크의 정확한 API 사용법
  - `scaffold.test.ts` — 테스트 격리 패턴 (tmpdir + cleanup)을 정확히 복제해야 테스트 간 간섭 없음

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file created: `src/lib/context-dir.test.ts`
  - [ ] `npx vitest run context-dir` → PASS (4 tests, 0 failures)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: .context/ 우선순위 — 둘 다 존재할 때 .context/ 반환
    Tool: Bash (npx vitest run)
    Preconditions: test file에 4가지 케이스 작성됨
    Steps:
      1. npx vitest run context-dir --reporter=verbose
      2. 출력에서 "4 passed" 확인
    Expected Result: 4 tests passed, 0 failed
    Failure Indicators: "FAIL" 또는 "0 passed" 출력
    Evidence: .sisyphus/evidence/task-2-context-dir-tests.txt

  Scenario: resolveContextDir — fallback 없는 빈 프로젝트에서 .context/ 기본값 반환
    Tool: Bash (node)
    Preconditions: 임시 빈 디렉토리 생성
    Steps:
      1. 임시 디렉토리에서 resolveContextDir 호출
      2. 반환값이 join(tmpDir, '.context')와 일치하는지 확인
    Expected Result: 빈 프로젝트에서도 크래시 없이 .context/ 경로 반환
    Failure Indicators: 에러 throw 또는 undefined 반환
    Evidence: .sisyphus/evidence/task-2-context-dir-empty.txt
  ```

  **Commit**: YES
  - Message: `feat(core): add resolveContextDir with .context/ fallback`
  - Files: `src/lib/context-dir.ts`, `src/lib/context-dir.test.ts`
  - Pre-commit: `npx vitest run context-dir`

- [x] 3. AGENTS.md 마커 기반 주입 모듈 TDD

  **What to do**:
  - `src/omx/agents-md.ts` 생성 — AGENTS.md에 마커 기반으로 컨텐츠를 주입/갱신하는 모듈
  - 마커 문자열: `<!-- context:start -->` / `<!-- context:end -->`
  - 핵심 함수: `injectIntoAgentsMd(agentsMdPath: string, content: string): void`
    - AGENTS.md 없음 → 파일 생성, 마커 + content 작성
    - AGENTS.md 있으나 마커 없음 → 파일 끝에 마커 + content 추가 (기존 내용 보존)
    - AGENTS.md 있고 마커 있음 → 마커 사이 내용만 교체 (기존 나머지 보존)
    - 멱등성: 2번 호출해도 마커 블록이 중복되지 않음
  - Atomic write: `writeFileSync(path + '.tmp', ...)` → `renameSync(path + '.tmp', path)` — race condition 방지
  - `src/omx/agents-md.test.ts` 생성 — TDD로 4가지 케이스 + 멱등성 + 기존 내용 보존 테스트
  - 테스트는 실제 `os.tmpdir()` + unique suffix 사용

  **Must NOT do**:
  - `Bun.*` API 사용 금지
  - `node:fs` 외 외부 라이브러리 의존 금지
  - 마커를 정규식으로 검색할 때 greedy match 사용 금지 — lazy match (`[\s\S]*?`) 또는 라인별 탐색

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: TDD + 마커 파싱/주입 로직은 엣지 케이스가 많음 (빈 파일, 깨진 마커, 멱등성)
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-dev`: OMX 전용 모듈이지만 파일 조작 로직은 플랫폼 독립적

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:319-348` — `scaffoldIfNeeded()`의 멱등 파일 쓰기 패턴 (existsSync → writeFileSync)
  - `src/lib/prompt-reader.ts` — 파일 읽기 + 에러 핸들링 패턴 (try/catch → null 반환)
  - [[docs/pattern-d8-prompt-markers.md]] — 기존 D8 프롬프트 마커 패턴. 마커 설계에 참고할 수 있음

  **API/Type References**:
  - `node:fs` — `readFileSync`, `writeFileSync`, `renameSync`, `existsSync`
  - `node:path` — `join`

  **Test References**:
  - `src/lib/scaffold.test.ts` — tmpdir 격리 패턴, describe/it 구조
  - `src/lib/prompt-reader.test.ts` — 파일 없음/있음 케이스 테스트 패턴

  **WHY Each Reference Matters**:
  - `scaffold.ts:319-348` — 파일 쓰기의 멱등성 보장 패턴을 그대로 적용
  - `prompt-reader.ts` — 파일 없을 때 graceful 처리 패턴
  - `pattern-d8-prompt-markers.md` — 기존 마커 설계 결정 참고 (충돌 방지)

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file created: `src/omx/agents-md.test.ts`
  - [ ] `npx vitest run agents-md` → PASS (6+ tests, 0 failures)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AGENTS.md 없는 프로젝트에서 마커 블록 생성
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 AGENTS.md 없음
    Steps:
      1. injectIntoAgentsMd(join(tmpDir, 'AGENTS.md'), '## Available Knowledge\n- docs/foo.md')
      2. 파일 내용 읽기
      3. '<!-- context:start -->' 와 '<!-- context:end -->' 사이에 content 존재 확인
    Expected Result: AGENTS.md 생성됨, 마커 블록 안에 content 포함
    Failure Indicators: 파일 미생성 또는 마커 누락
    Evidence: .sisyphus/evidence/task-3-agents-md-create.txt

  Scenario: 기존 AGENTS.md에 마커 없을 때 끝에 추가
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 "# My Project\nSome content" 내용의 AGENTS.md 존재
    Steps:
      1. injectIntoAgentsMd 호출
      2. 파일 내용에서 "# My Project" 와 "Some content" 가 보존되었는지 확인
      3. 마커 블록이 파일 끝에 추가되었는지 확인
    Expected Result: 기존 내용 보존 + 마커 블록이 끝에 추가
    Failure Indicators: 기존 내용 덮어쓰기 또는 마커 없음
    Evidence: .sisyphus/evidence/task-3-agents-md-append.txt

  Scenario: 멱등성 — 2회 호출 시 마커 블록 중복 없음
    Tool: Bash (npx vitest run)
    Preconditions: AGENTS.md에 마커 블록 1개 존재
    Steps:
      1. injectIntoAgentsMd를 동일 content로 2번 호출
      2. 파일 내용에서 '<!-- context:start -->' 출현 횟수 카운트
    Expected Result: 마커 블록이 정확히 1개
    Failure Indicators: '<!-- context:start -->' 가 2회 이상 출현
    Evidence: .sisyphus/evidence/task-3-agents-md-idempotent.txt
  ```

  **Commit**: YES
  - Message: `feat(omx): add AGENTS.md marker injection module`
  - Files: `src/omx/agents-md.ts`, `src/omx/agents-md.test.ts`
  - Pre-commit: `npx vitest run agents-md`

- [x] 4. ADR-003 OMX 호환성 + turn-end 조사 문서 작성

  **What to do**:
  - `docs/adr-003-omx-compatibility.md` 작성 — ADR 템플릿 사용
    - 맥락: 현재 OpenCode 전용, OMX 수요 증가
    - 결정: AGENTS.md 자동 관리 방식, `.context/` 중립 디렉토리, 멀티 엔트리 패키지
    - 대안 검토: tmux.sendKeys 방식 / 별도 패키지 분리 / 런타임 감지
    - 트레이드오프: AGENTS.md 방식의 한계 (정적, 실시간 아님)
  - `docs/decision-omx-turn-end-investigation.md` 작성 — Decision 템플릿 사용
    - 조사 필요성: turn-complete 이벤트 + tmux.sendKeys로 turn-end 주입 가능성
    - 위험: tmux loop guard, 타이밍 이슈, 안정성
    - 결정: 이번 스코프에서 구현 제외, 향후 별도 작업으로 검토
    - 종료 기준: OMX에서 turn-complete → tmux.sendKeys가 안정적으로 동작하는지 실험 필요

  **Must NOT do**:
  - 구현 코드 작성 금지 — 문서만
  - 기존 문서 수정 금지 — 이 태스크는 새 문서만 생성 (architecture.md 업데이트는 Task 12)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 순수 문서 작성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `docs/adr-001-zettelkasten-hook-templates.md` — 기존 ADR 작성 스타일 참고
  - `docs/adr-002-domain-index-knowledge-structure.md` — ADR 구조 패턴 (상태/맥락/결정/결과)
  - `docs/decision-scaffold-auto-update-scope.md` — Decision 노트 작성 스타일 참고

  **External References**:
  - `https://github.com/Yeachan-Heo/oh-my-codex/blob/main/docs/hooks-extension.md` — OMX 훅 시스템 공식 문서. ADR의 맥락 섹션에서 OMX 제약사항 설명에 활용

  **WHY Each Reference Matters**:
  - `adr-001`, `adr-002` — ADR의 섹션 구조(상태/맥락/결정/결과/관련노트)를 그대로 따라야 일관성 유지
  - `decision-scaffold-auto-update-scope.md` — 짧은 decision 노트의 양식 참고

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: ADR-003 파일 존재 및 구조 확인
    Tool: Bash (node)
    Preconditions: 문서 작성 완료
    Steps:
      1. docs/adr-003-omx-compatibility.md 파일 존재 확인
      2. 파일 첫 줄이 '# ADR-003:' 으로 시작하는지 확인
      3. '## 맥락', '## 결정', '## 결과' 섹션이 모두 존재하는지 확인
    Expected Result: 파일 존재, ADR 구조 완성
    Failure Indicators: 파일 미존재 또는 필수 섹션 누락
    Evidence: .sisyphus/evidence/task-4-adr-003.txt

  Scenario: Decision 노트 존재 확인
    Tool: Bash (node)
    Preconditions: 문서 작성 완료
    Steps:
      1. docs/decision-omx-turn-end-investigation.md 파일 존재 확인
      2. '# Decision:' 으로 시작하는지 확인
    Expected Result: 파일 존재, Decision 구조 완성
    Failure Indicators: 파일 미존재
    Evidence: .sisyphus/evidence/task-4-decision-turn-end.txt
  ```

  **Commit**: YES
  - Message: `docs: add ADR-003 OMX compatibility + turn-end investigation note`
  - Files: `docs/adr-003-omx-compatibility.md`, `docs/decision-omx-turn-end-investigation.md`

- [x] 5. constants.ts .context/ 경로 이전 + scaffold.ts 리팩토링

  **What to do**:
  - `src/constants.ts` — `DEFAULTS` 경로를 `.opencode/context/` → `.context/`로 변경:
    - `configPath`: `.opencode/context/config.jsonc` → `.context/config.jsonc`
    - `promptDir`: `.opencode/context/prompts` → `.context/prompts`
    - `templateDir`: `.opencode/context/templates` → `.context/templates`
  - `src/lib/scaffold.ts` — 모든 하드코딩된 `join(projectDir, '.opencode', 'context')` 호출을 `resolveContextDir(projectDir)` (Task 2에서 생성)로 교체:
    - `scaffoldIfNeeded()` (line 320): `const contextDir = resolveContextDir(projectDir)`
    - `updateScaffold()` (line 351): 동일
    - `getStoredVersion()` (line 388): `resolveContextDir` 사용
    - `autoUpdateTemplates()` (line 407): 동일
    - `updatePrompts()` (line 433): 동일
  - 기존 `scaffold.test.ts` 테스트 업데이트 — `.opencode/context/`를 기대하는 assertion을 `.context/`로 변경
  - **주의**: `resolveContextDir`은 fallback 로직을 포함하므로, `.opencode/context/`만 있는 기존 프로젝트에서도 scaffold 함수들이 정상 동작해야 함

  **Must NOT do**:
  - `src/index.ts` (OpenCode 엔트리) 수정 금지 — 별도 Task 11에서 처리
  - `DEFAULT_CONFIG`, `DEFAULT_TURN_START`, `DEFAULT_TURN_END` 문자열 리터럴 수정 금지 — 별도 Task 7에서 처리
  - scaffold의 기존 멱등성 동작 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 5개 함수를 일관되게 리팩토링하면서 기존 테스트를 모두 통과시켜야 함. 의존성 파악이 중요
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: scaffold.ts의 기존 아키텍처 패턴 이해에 도움

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7 — 단 Task 7은 5 이후)
  - **Blocks**: Tasks 7, 8, 9, 11
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:319-348` — `scaffoldIfNeeded()` 현재 구조. `join(projectDir, '.opencode', 'context')` 하드코딩을 `resolveContextDir(projectDir)`로 교체할 위치
  - `src/lib/scaffold.ts:350-380` — `updateScaffold()` 동일 패턴
  - `src/lib/scaffold.ts:386-392` — `getStoredVersion()` 하드코딩 경로
  - `src/lib/scaffold.ts:406-430` — `autoUpdateTemplates()` 하드코딩 경로
  - `src/lib/scaffold.ts:432-454` — `updatePrompts()` 하드코딩 경로

  **API/Type References**:
  - `src/lib/context-dir.ts` (Task 2에서 생성) — `resolveContextDir(projectDir: string): string`
  - `src/constants.ts:1-11` — DEFAULTS 정의. configPath, promptDir, templateDir 변경 대상

  **Test References**:
  - `src/lib/scaffold.test.ts` — 기존 테스트에서 `.opencode/context/` 경로를 expect하는 부분 → `.context/`로 갱신 필요
  - `src/lib/context-dir.test.ts` (Task 2에서 생성) — resolveContextDir 동작 보장

  **WHY Each Reference Matters**:
  - `scaffold.ts` 5개 함수 — 이 모든 함수가 하드코딩 경로를 사용하고 있어 빠뜨리면 불일치 발생
  - `scaffold.test.ts` — 테스트를 먼저 업데이트해야 TDD 워크플로우 유지 가능
  - `constants.ts` — DEFAULTS 변경이 config.ts 등 다른 모듈에 파급될 수 있으므로 영향도 확인 필요

  **Acceptance Criteria**:

  **TDD:**
  - [ ] `npx vitest run scaffold` → PASS (기존 테스트 + 업데이트된 경로 assertions)
  - [ ] `npx vitest run` → 전체 PASS (regression 없음)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 새 프로젝트에서 scaffoldIfNeeded가 .context/ 에 생성
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 아무 설정 디렉토리 없음
    Steps:
      1. scaffoldIfNeeded(tmpDir) 호출
      2. join(tmpDir, '.context', 'config.jsonc') 존재 확인
      3. join(tmpDir, '.context', 'prompts', 'turn-start.md') 존재 확인
      4. join(tmpDir, '.opencode', 'context') 가 생성되지 않았는지 확인
    Expected Result: .context/ 하위에 scaffold 생성, .opencode/context/ 미생성
    Failure Indicators: .opencode/context/ 생성 또는 .context/ 미생성
    Evidence: .sisyphus/evidence/task-5-scaffold-new-project.txt

  Scenario: 기존 .opencode/context/ 프로젝트에서 scaffoldIfNeeded 스킵
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .opencode/context/ 존재 (resolveContextDir가 이를 반환)
    Steps:
      1. scaffoldIfNeeded(tmpDir) 호출
      2. return false 확인 (이미 존재)
      3. .opencode/context/ 내용이 변경되지 않았는지 확인
    Expected Result: false 반환, 기존 구조 보존
    Failure Indicators: true 반환 또는 .context/ 새로 생성
    Evidence: .sisyphus/evidence/task-5-scaffold-legacy-skip.txt

  Scenario: DEFAULTS 변경 regression — 전체 테스트 통과
    Tool: Bash (npx vitest run)
    Preconditions: constants.ts 경로 변경 완료
    Steps:
      1. npx vitest run --reporter=verbose
    Expected Result: 전체 테스트 PASS
    Failure Indicators: 어떤 테스트든 FAIL
    Evidence: .sisyphus/evidence/task-5-full-regression.txt
  ```

  **Commit**: YES
  - Message: `refactor(core): migrate scaffold paths to .context/ with resolveContextDir`
  - Files: `src/constants.ts`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`
  - Pre-commit: `npx vitest run`

- [x] 6. config.ts fallback 로직 적용

  **What to do**:
  - `src/lib/config.ts` — `loadConfig(projectDir)` 함수에서 config 파일 경로 해석에 `resolveContextDir` 적용
  - 현재: `join(projectDir, DEFAULTS.configPath)` — DEFAULTS.configPath가 `.context/config.jsonc`로 변경됨 (Task 5)
  - 변경: config 파일 경로를 `join(resolveContextDir(projectDir), 'config.jsonc')`로 해석
  - `getDefaultConfig()` 함수도 DEFAULTS 변경에 맞춰 확인 (promptDir → `.context/prompts`)
  - `config.test.ts` 업데이트 — `.opencode/context/` 경로 기대값을 `.context/`로 변경
  - fallback 동작 확인: `.context/config.jsonc` 없고 `.opencode/context/config.jsonc` 있으면 후자 사용

  **Must NOT do**:
  - `ContextConfig` 타입 변경 금지
  - config 파일 포맷 (JSONC) 변경 금지
  - `mergeWithDefaults()` 로직 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 기존 모듈 수정 + 테스트 업데이트. 패턴이 명확하지만 fallback 로직 정확성이 중요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Tasks 8, 9, 11
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/lib/config.ts:37-49` — 현재 `loadConfig` 구현. `join(projectDir, DEFAULTS.configPath)` 경로 해석
  - `src/lib/config.ts:10-11` — `getDefaultConfig()` 에서 DEFAULTS.promptDir 사용

  **API/Type References**:
  - `src/lib/context-dir.ts` (Task 2) — `resolveContextDir(projectDir)`
  - `src/types.ts:1-13` — `ContextConfig` 타입 (변경 없음)
  - `src/constants.ts` (Task 5에서 변경됨) — 새 DEFAULTS 경로

  **Test References**:
  - `src/lib/config.test.ts` — 기존 config 테스트. `.opencode/context/` 경로 fixture를 `.context/`로 갱신

  **WHY Each Reference Matters**:
  - `config.ts:37-49` — 정확히 이 코드에서 경로 해석이 일어남. resolveContextDir 적용 위치
  - `config.ts:10-11` — getDefaultConfig도 DEFAULTS 변경 영향을 받을 수 있음

  **Acceptance Criteria**:

  **TDD:**
  - [ ] `npx vitest run config` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: .context/config.jsonc에서 설정 로드
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .context/config.jsonc 파일 작성
    Steps:
      1. loadConfig(tmpDir) 호출
      2. 반환된 config가 .context/config.jsonc 내용을 반영하는지 확인
    Expected Result: .context/ 기반 config 정상 로드
    Failure Indicators: 기본값 반환 (config 파일 무시됨)
    Evidence: .sisyphus/evidence/task-6-config-new-path.txt

  Scenario: fallback — .opencode/context/config.jsonc에서 로드
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .context/ 없음, .opencode/context/config.jsonc만 존재
    Steps:
      1. loadConfig(tmpDir) 호출
      2. 반환된 config가 .opencode/context/config.jsonc 내용을 반영하는지 확인
    Expected Result: fallback으로 legacy 경로에서 정상 로드
    Failure Indicators: 기본값 반환 (fallback 미동작)
    Evidence: .sisyphus/evidence/task-6-config-fallback.txt
  ```

  **Commit**: YES
  - Message: `refactor(core): apply resolveContextDir to config loading`
  - Files: `src/lib/config.ts`, `src/lib/config.test.ts`
  - Pre-commit: `npx vitest run config`

- [x] 7. DEFAULT_CONFIG/prompts 경로 갱신

  **What to do**:
  - `src/lib/scaffold.ts` 내 `DEFAULT_CONFIG` 문자열 리터럴 수정:
    - `"turnStart": ".opencode/context/prompts/turn-start.md"` → `"turnStart": "prompts/turn-start.md"` (상대 경로)
    - `"turnEnd": ".opencode/context/prompts/turn-end.md"` → `"turnEnd": "prompts/turn-end.md"` (상대 경로)
  - `DEFAULT_TURN_END` 내 템플릿 링크 경로 수정:
    - `.opencode/context/templates/adr.md` → `.context/templates/adr.md`
    - 나머지 8개 템플릿 링크도 동일하게 수정 (lines 73-80 부근)
  - **중요**: config 파일에서 상대 경로를 사용하므로, `loadConfig` + `src/index.ts`에서 prompt 경로 해석 시 `resolveContextDir` 기준으로 resolve 해야 함. 이 변경이 `src/index.ts`에 영향을 줄 수 있으나, Task 11에서 처리
  - scaffold.test.ts에서 DEFAULT_CONFIG 내용 검증 assertion 업데이트

  **Must NOT do**:
  - `DEFAULT_TURN_START` 내용 변경 금지 (제텔카스텐 가이드 본문)
  - 템플릿 파일 내용 (adr.md, pattern.md 등) 변경 금지
  - `src/index.ts` 수정 금지 — Task 11에서 처리

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 문자열 리터럴 수정이지만 경로 해석 체인에 미치는 영향 분석이 중요
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: scaffold 파일 구조와 config 해석 패턴 이해

  **Parallelization**:
  - **Can Run In Parallel**: NO (Task 5 이후)
  - **Parallel Group**: Wave 2 (Task 5 완료 후)
  - **Blocks**: Tasks 8, 11
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/lib/scaffold.ts:8-19` — `DEFAULT_CONFIG` 문자열 리터럴. 정확히 이 줄들의 경로를 수정
  - `src/lib/scaffold.ts:73-80` — `DEFAULT_TURN_END` 내 `.opencode/context/templates/...` 링크들. 이 줄들을 `.context/templates/...`로 수정

  **API/Type References**:
  - `src/index.ts:52-54` — `config.prompts.turnStart` 경로를 `join(directory, ...)`로 resolve. 상대 경로 변경 시 이 로직에 영향
  - `src/lib/config.ts:10` — `getDefaultConfig()`에서 `DEFAULTS.promptDir` 사용. 상대 경로 변경과 어떻게 상호작용하는지 확인 필요

  **Test References**:
  - `src/lib/scaffold.test.ts` — DEFAULT_CONFIG 내용을 검증하는 테스트. 경로 기대값 업데이트
  - `src/index.test.ts` — prompt 경로 해석 관련 테스트. Task 11에서 업데이트하므로 여기서는 건드리지 않음

  **WHY Each Reference Matters**:
  - `scaffold.ts:8-19` — 이 문자열이 사용자 디스크에 기록됨. 수정 후 새 프로젝트는 상대 경로를 갖게 됨
  - `scaffold.ts:73-80` — 사용자에게 보이는 템플릿 링크. `.opencode/` 참조가 남으면 혼란 유발
  - `index.ts:52-54` — 상대 경로로 변경 시 resolve 로직이 `resolveContextDir` 기준이 되어야 함을 확인하는 데 필요

  **Acceptance Criteria**:

  **TDD:**
  - [ ] `npx vitest run scaffold` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 새 scaffold의 config.jsonc가 상대 경로 사용
    Tool: Bash (npx vitest run)
    Preconditions: 빈 tmpdir에서 scaffoldIfNeeded 실행
    Steps:
      1. scaffoldIfNeeded(tmpDir) 호출
      2. join(resolveContextDir(tmpDir), 'config.jsonc') 파일 읽기
      3. config 내 "turnStart" 값이 "prompts/turn-start.md" 인지 확인 (절대 경로 아님)
      4. config 내 "turnEnd" 값이 "prompts/turn-end.md" 인지 확인
    Expected Result: config.jsonc에 상대 경로만 포함
    Failure Indicators: ".opencode/" 또는 ".context/" prefix가 포함된 절대 경로
    Evidence: .sisyphus/evidence/task-7-config-relative-paths.txt

  Scenario: DEFAULT_TURN_END의 템플릿 링크가 .context/ 경로 사용
    Tool: Bash (npx vitest run)
    Preconditions: scaffold 실행 완료
    Steps:
      1. turn-end.md 파일 읽기
      2. ".opencode/context/templates/" 문자열이 없는지 확인
      3. ".context/templates/" 문자열이 포함되어 있는지 확인
    Expected Result: 템플릿 링크가 .context/ 경로 사용
    Failure Indicators: ".opencode/" 경로가 남아있음
    Evidence: .sisyphus/evidence/task-7-turn-end-links.txt
  ```

  **Commit**: YES
  - Message: `refactor(core): update DEFAULT_CONFIG and prompt template paths to .context/`
  - Files: `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`
  - Pre-commit: `npx vitest run scaffold`

- [x] 8. OMX 엔트리포인트 TDD

  **What to do**:
  - `src/omx/index.ts` 생성 — OMX 플러그인 엔트리포인트
  - `onHookEvent(event, sdk)` export:
    - `event.event === 'session-start'` 처리:
      1. `resolveContextDir(projectDir)`로 설정 디렉토리 해석
      2. `scaffoldIfNeeded(projectDir)` — 최초 실행 시 `.context/` 스캐폴드 생성
      3. `loadConfig(projectDir)` — 설정 로드
      4. `readPromptFile(turnStartPath)` — turn-start 프롬프트 읽기 + 변수 치환
      5. `buildKnowledgeIndexV2()` + `formatKnowledgeIndex/formatDomainIndex()` — knowledge index 빌드
      6. turn-start + knowledge index 결합하여 `injectIntoAgentsMd()` (Task 3 모듈) 호출
      7. `sdk.log.info(...)` — 로깅
    - 다른 이벤트는 무시 (early return)
  - **projectDir 해석**: OMX 이벤트에서 프로젝트 루트를 어떻게 얻는지 확인 필요. `event.context`에 포함될 수 있음. 또는 `process.cwd()` 사용. fallback으로 `process.cwd()` 사용
  - `src/omx/index.test.ts` 생성 — TDD 통합 테스트:
    - mock SDK (sdk.log만 mock, 실제 파일시스템 사용)
    - tmpdir에 `.context/` + `docs/` + AGENTS.md 설정 후 `onHookEvent` 호출
    - AGENTS.md에 마커 블록 + knowledge index가 주입되었는지 확인

  **Must NOT do**:
  - `Bun.*` API 사용 금지
  - `sdk.tmux.sendKeys()` 사용 금지 (turn-end 미구현)
  - `sdk.state` 사용 금지 (scope 외)
  - OMX derived signals 처리 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: OMX 플러그인의 핵심 로직. 코어 모듈 통합 + OMX SDK 계약 준수 + TDD
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: 플러그인 아키텍처 패턴, 특히 초기화 흐름과 훅 등록 패턴 참고

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11)
  - **Blocks**: Tasks 10, 12
  - **Blocked By**: Tasks 2, 3, 5, 6, 7

  **References**:

  **Pattern References**:
  - `src/index.ts:13-110` — OpenCode 엔트리포인트 전체. 이 파일의 초기화 흐름(scaffold → config → transform hook)을 OMX에서 대응하는 방식으로 구현
  - `src/omx/agents-md.ts` (Task 3) — `injectIntoAgentsMd()` 함수. OMX 엔트리에서 호출
  - `src/lib/context-dir.ts` (Task 2) — `resolveContextDir()`. 프로젝트 디렉토리 해석

  **API/Type References**:
  - OMX Plugin Contract: `export async function onHookEvent(event: { event: string; timestamp: string; source: string; context: object }, sdk: { log: { info: Function; warn: Function; error: Function }; tmux: { sendKeys: Function }; state: { read: Function; write: Function } }): Promise<void>`
  - `src/lib/config.ts` — `loadConfig(projectDir)`
  - `src/lib/knowledge-index.ts` — `buildKnowledgeIndexV2(projectDir, config.knowledge)`, `formatKnowledgeIndex()`, `formatDomainIndex()`
  - `src/lib/prompt-reader.ts` — `readPromptFile(path)`, `resolvePromptVariables(raw, vars)`
  - `src/lib/scaffold.ts` — `scaffoldIfNeeded(projectDir)`

  **External References**:
  - `https://github.com/Yeachan-Heo/oh-my-codex/blob/main/docs/hooks-extension.md` — OMX 플러그인 계약 공식 문서
  - OMX 이벤트 envelope 구조: `{ schema_version, event, timestamp, source, context, session_id?, thread_id?, turn_id?, mode? }`

  **WHY Each Reference Matters**:
  - `src/index.ts:13-110` — OpenCode 엔트리의 초기화 흐름을 참고하되, OMX에서는 메시지 변환 대신 AGENTS.md 주입으로 대체
  - OMX Plugin Contract — `onHookEvent` 시그니처와 SDK 인터페이스를 정확히 맞춰야 OMX 런타임에서 로드 가능
  - `knowledge-index.ts` — 이미 검증된 knowledge index 빌더를 그대로 재사용

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file created: `src/omx/index.test.ts`
  - [ ] `npx vitest run omx` → PASS (3+ tests, 0 failures)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: session-start 이벤트에서 AGENTS.md에 knowledge index 주입
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .context/ scaffold + docs/architecture.md 생성
    Steps:
      1. mock sdk 생성 (sdk.log.info/warn/error)
      2. onHookEvent({ event: 'session-start', timestamp: Date.now(), source: 'native', context: {} }, mockSdk) 호출
      3. AGENTS.md 파일 읽기
      4. '<!-- context:start -->' 존재 확인
      5. 'docs/architecture.md' 가 knowledge index에 포함되었는지 확인
      6. sdk.log.info가 호출되었는지 확인
    Expected Result: AGENTS.md에 마커 블록 + knowledge index 포함
    Failure Indicators: AGENTS.md 미생성 또는 마커/knowledge index 누락
    Evidence: .sisyphus/evidence/task-8-omx-session-start.txt

  Scenario: session-start 외 이벤트 무시
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .context/ scaffold
    Steps:
      1. onHookEvent({ event: 'turn-complete', ... }, mockSdk) 호출
      2. AGENTS.md 파일이 생성되지 않았는지 확인
    Expected Result: turn-complete에서는 아무 동작 없음
    Failure Indicators: AGENTS.md 생성됨
    Evidence: .sisyphus/evidence/task-8-omx-ignore-other.txt

  Scenario: scaffold 없는 프로젝트에서 session-start — 자동 scaffold
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .context/ 와 .opencode/context/ 모두 없음
    Steps:
      1. onHookEvent({ event: 'session-start', ... }, mockSdk) 호출
      2. .context/ 디렉토리 생성 확인
      3. .context/config.jsonc 존재 확인
      4. AGENTS.md 생성 확인
    Expected Result: 자동 scaffold 후 AGENTS.md 주입
    Failure Indicators: scaffold 미생성 또는 에러 throw
    Evidence: .sisyphus/evidence/task-8-omx-auto-scaffold.txt
  ```

  **Commit**: YES
  - Message: `feat(omx): add OMX plugin entry point with session-start handler`
  - Files: `src/omx/index.ts`, `src/omx/index.test.ts`
  - Pre-commit: `npx vitest run omx`

- [x] 9. CLI migrate 커맨드 TDD

  **What to do**:
  - `src/cli/commands/migrate.ts` 생성:
    - `.opencode/context/` 존재 확인 → 없으면 "Nothing to migrate" 메시지 출력, exit 0
    - `.context/` 이미 존재 → "Target .context/ already exists. Aborting." 메시지 출력, exit 1
    - `.opencode/context/` → `.context/`로 디렉토리 복사 (재귀)
    - config.jsonc 내 경로 갱신: `.opencode/context/prompts/...` → `prompts/...` (상대 경로)
    - 복사 성공 후 `.opencode/context/` 삭제 (optional flag로 보존 가능)
    - 성공 메시지: "Migrated .opencode/context/ → .context/"
  - `src/cli/commands/migrate.test.ts` 생성 — TDD:
    - `.opencode/context/` 없음 → exit 0 + "Nothing to migrate"
    - `.context/` 이미 존재 → exit 1 + abort
    - 정상 마이그레이션 → 파일 복사 확인 + config 경로 갱신 확인
    - 멱등성 — 마이그레이션 후 재실행 시 "Nothing to migrate"
  - `src/cli/index.ts` — `migrate` 서브커맨드 추가 (기존 `update` 패턴 따라)

  **Must NOT do**:
  - `git mv` 등 git 연산 금지 — plain `node:fs` 만
  - `.context/` 이미 존재할 때 머지/덮어쓰기 금지 — abort

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CLI 커맨드 TDD. 파일시스템 연산 + 에러 핸들링 + 기존 CLI 패턴 따라야 함
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 10, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 2, 5, 6

  **References**:

  **Pattern References**:
  - `src/cli/index.ts` — CLI 진입점. 서브커맨드 라우팅 패턴 (`process.argv` 파싱)
  - `src/cli/commands/update.ts` — 기존 CLI 커맨드 구현. 서브커맨드 함수 시그니처, stdout 출력 패턴, exit code 패턴

  **API/Type References**:
  - `node:fs` — `cpSync` (Node 16.7+), `rmSync`, `existsSync`, `readFileSync`, `writeFileSync`
  - `node:path` — `join`
  - `src/lib/context-dir.ts` (Task 2) — `resolveContextDir()` 참고 (migrate는 직접 경로를 다루지만, 해석 로직 참고)

  **Test References**:
  - `src/cli/cli.test.ts` — CLI 통합 테스트 패턴. subprocess 실행 및 stdout/exit code 검증
  - `src/cli/commands/update.test.ts` — update 서브커맨드 단위 테스트 패턴

  **WHY Each Reference Matters**:
  - `cli/index.ts` — `migrate` 서브커맨드를 기존 라우팅에 추가할 정확한 위치
  - `commands/update.ts` — CLI 함수의 시그니처, 에러 핸들링, stdout 출력 패턴을 그대로 따라 일관성 유지

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file created: `src/cli/commands/migrate.test.ts`
  - [ ] `npx vitest run migrate` → PASS (4+ tests, 0 failures)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: .opencode/context/ 없을 때 "Nothing to migrate"
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .opencode/context/ 없음
    Steps:
      1. migrate 함수 호출 (또는 CLI subprocess)
      2. 출력에 "Nothing to migrate" 포함 확인
      3. exit code 0 확인
    Expected Result: 안전하게 종료
    Failure Indicators: 에러 throw 또는 비정상 종료
    Evidence: .sisyphus/evidence/task-9-migrate-nothing.txt

  Scenario: .context/ 이미 존재할 때 abort
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .opencode/context/ + .context/ 모두 존재
    Steps:
      1. migrate 함수 호출
      2. 출력에 "already exists" 포함 확인
      3. .opencode/context/ 가 삭제되지 않았는지 확인
    Expected Result: abort, 기존 파일 보존
    Failure Indicators: .opencode/context/ 삭제 또는 .context/ 덮어쓰기
    Evidence: .sisyphus/evidence/task-9-migrate-abort.txt

  Scenario: 정상 마이그레이션 후 config.jsonc 경로 갱신
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .opencode/context/config.jsonc (기존 형태: ".opencode/context/prompts/turn-start.md")
    Steps:
      1. migrate 함수 호출
      2. .context/config.jsonc 존재 확인
      3. config 내 "turnStart" 값이 "prompts/turn-start.md" (상대 경로)인지 확인
      4. .opencode/context/ 가 삭제되었는지 확인
    Expected Result: 파일 이동 + config 경로 갱신 + 원본 삭제
    Failure Indicators: config 경로 미갱신 또는 원본 미삭제
    Evidence: .sisyphus/evidence/task-9-migrate-success.txt
  ```

  **Commit**: YES
  - Message: `feat(cli): add migrate command for .opencode/context/ → .context/`
  - Files: `src/cli/commands/migrate.ts`, `src/cli/commands/migrate.test.ts`, `src/cli/index.ts`
  - Pre-commit: `npx vitest run migrate`

- [x] 10. 멀티 엔트리 package.json + OMX 빌드

  **What to do**:
  - `package.json` `exports` 필드 업데이트:
    ```json
    "exports": {
      ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "./omx": { "import": "./dist/omx/index.mjs", "types": "./dist/omx/index.d.ts", "default": "./dist/omx/index.mjs" }
    }
    ```
  - `package.json` `scripts.build` 업데이트 — OMX 빌드 추가:
    - 기존: `bun build ./src/index.ts --outdir dist --target bun && bun build ./src/cli/index.ts --outdir dist/cli --target bun`
    - 추가: `&& bun build ./src/omx/index.ts --outdir dist/omx --target node --format esm`
    - OMX 빌드 결과 파일명이 `.mjs`가 되도록 확인. `bun build`가 `.js`로 생성하면 빌드 후 rename 스크립트 추가
  - `package.json` `files` 필드에 `dist/omx` 포함 확인
  - `prepublishOnly` 스크립트도 동일하게 업데이트
  - 빌드 후 검증: `node --input-type=module -e "import('./dist/omx/index.mjs').then(m => console.log(typeof m.onHookEvent))"` → `"function"` 출력

  **Must NOT do**:
  - `"."` export 변경 금지 — 기존 OpenCode 경로 그대로 유지
  - `"main"` 필드 변경 금지
  - OMX 빌드에 `--target bun` 사용 금지 — `--target node` 사용

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: package.json 수정 + 빌드 스크립트 업데이트. 코드 작성보다는 설정 조정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 8 완료 후)
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 1, 8

  **References**:

  **Pattern References**:
  - `package.json:9-19` — 현재 `main`, `exports`, `bin` 구성. `"."` export를 건드리지 않고 `"./omx"` 추가

  **External References**:
  - Node.js Conditional Exports: https://nodejs.org/api/packages.html#conditional-exports
  - Bun Build docs: `--target node` 옵션이 표준 ESM 생성하는지 확인

  **WHY Each Reference Matters**:
  - `package.json:9-19` — 기존 exports 구조를 정확히 이해해야 additive 변경이 가능
  - Node.js Conditional Exports — `"./omx"` 엔트리가 올바른 subpath export인지 확인

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 빌드 성공 — OpenCode + OMX 모두 생성
    Tool: Bash
    Preconditions: 소스코드 모두 작성 완료
    Steps:
      1. mise run build
      2. dist/index.js 존재 확인
      3. dist/omx/index.mjs (또는 dist/omx/index.js) 존재 확인
      4. dist/cli/index.js 존재 확인
    Expected Result: 3개 빌드 아티팩트 모두 존재
    Failure Indicators: 빌드 에러 또는 파일 미생성
    Evidence: .sisyphus/evidence/task-10-build-artifacts.txt

  Scenario: OMX 빌드가 표준 ESM — node에서 import 가능
    Tool: Bash
    Preconditions: mise run build 성공
    Steps:
      1. node --input-type=module -e "import('./dist/omx/index.mjs').then(m => { if (typeof m.onHookEvent !== 'function') { console.error('FAIL: onHookEvent not found'); process.exit(1); } console.log('PASS: onHookEvent is function'); })"
    Expected Result: "PASS: onHookEvent is function" 출력, exit 0
    Failure Indicators: import 에러 또는 onHookEvent 미발견
    Evidence: .sisyphus/evidence/task-10-omx-esm-import.txt

  Scenario: 기존 OpenCode export 변경 없음
    Tool: Bash
    Preconditions: mise run build 성공
    Steps:
      1. node -e "const p = require('./package.json'); if (p.exports['.'].import !== './dist/index.js') process.exit(1)"
    Expected Result: exit 0 — OpenCode export 경로 유지
    Failure Indicators: exit 1 — export 경로가 변경됨
    Evidence: .sisyphus/evidence/task-10-opencode-export.txt
  ```

  **Commit**: YES
  - Message: `build: add OMX multi-entry export and build target`
  - Files: `package.json`
  - Pre-commit: `mise run build && node --input-type=module -e "import('./dist/omx/index.mjs').then(m => { if (typeof m.onHookEvent !== 'function') process.exit(1) })"`

- [x] 11. OpenCode 엔트리포인트 .context/ fallback 적용

  **What to do**:
  - `src/index.ts` 수정 — prompt 경로 해석 로직 업데이트:
    - 현재: `join(directory, config.prompts.turnStart ?? join(DEFAULTS.promptDir, DEFAULTS.turnStartFile))` — DEFAULTS가 `.context/prompts`로 변경됨 (Task 5)
    - **변경 필요**: config에 절대 경로 (`.opencode/context/prompts/turn-start.md`) 가 있으면 그대로 사용, 상대 경로 (`prompts/turn-start.md`) 면 `resolveContextDir` 기준으로 resolve
    - `resolveContextDir(directory)`를 import하여 prompt/config 경로의 base 디렉토리로 사용
    - `scaffoldIfNeeded(directory)` 호출은 이미 Task 5에서 resolveContextDir를 사용하므로 자동 적용
  - `src/index.test.ts` 업데이트 — `.context/` 경로 기반 테스트 + `.opencode/context/` fallback 테스트 추가
  - **핵심 주의**: 이 태스크가 G1("src/index.ts 동작 변경 금지")과 충돌하는 것처럼 보이지만, 이는 기존 동작의 "보존"을 위한 업데이트임. DEFAULTS 변경에 대응하여 기존 사용자에게 동일한 동작을 제공하는 것이 목적

  **Must NOT do**:
  - OpenCode 플러그인의 외부 인터페이스 (`Plugin` 타입 시그니처) 변경 금지
  - 메시지 주입 로직 변경 금지 — 경로 해석만 수정
  - `experimental.chat.messages.transform` 훅 동작 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: OpenCode 핵심 엔트리포인트 수정. 하위호환이 절대적으로 중요
  - **Skills**: [`opencode-plugin-dev`]
    - `opencode-plugin-dev`: OpenCode 플러그인 API 타입, 메시지 구조체 이해

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 2, 5, 6, 7

  **References**:

  **Pattern References**:
  - `src/index.ts:13-110` — 전체 OpenCode 엔트리포인트. 수정 대상
  - `src/index.ts:52-57` — turn-start 경로 해석. 이 부분에 resolveContextDir 적용
  - `src/index.ts:77-80` — turn-end 경로 해석. 동일하게 수정

  **API/Type References**:
  - `@opencode-ai/plugin` — `Plugin` 타입. 시그니처 변경 금지
  - `src/lib/context-dir.ts` (Task 2) — `resolveContextDir()`
  - `src/lib/config.ts` — `loadConfig()` (Task 6에서 이미 fallback 적용됨)

  **Test References**:
  - `src/index.test.ts` — 기존 OpenCode 엔트리 테스트. `.opencode/context/` 경로를 `.context/`로 갱신 + fallback 케이스 추가

  **WHY Each Reference Matters**:
  - `index.ts:52-57, 77-80` — 정확히 이 줄에서 prompt 파일을 `join(directory, ...)` 로 resolve함. DEFAULTS 변경 + 상대 경로 config 지원을 위해 resolveContextDir를 끼워넣어야 함
  - `index.test.ts` — 기존 테스트가 `.opencode/context/` 경로를 하드코딩하고 있을 가능성 높음. 업데이트 필수

  **Acceptance Criteria**:

  **TDD:**
  - [ ] `npx vitest run` → PASS (전체 통과 — regression 제로)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: .context/ 기반 프로젝트에서 OpenCode 엔트리 정상 동작
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .context/ scaffold 완료
    Steps:
      1. OpenCode 플러그인 초기화 (plugin({ directory: tmpDir, client: mockClient }))
      2. messages.transform 훅 호출
      3. lastUserMsg.parts에 turn-start + knowledge index 주입 확인
    Expected Result: .context/ 기반에서 정상 주입
    Failure Indicators: 주입 실패 또는 에러
    Evidence: .sisyphus/evidence/task-11-opencode-new-path.txt

  Scenario: .opencode/context/ fallback — 기존 사용자 하위호환
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .opencode/context/ 만 존재 (.context/ 없음)
    Steps:
      1. plugin({ directory: tmpDir, client: mockClient }) 초기화
      2. messages.transform 훅 호출
      3. turn-start 주입 확인 (기존 .opencode/context/ 기반)
    Expected Result: fallback으로 .opencode/context/ 에서 정상 동작
    Failure Indicators: 에러 또는 빈 주입
    Evidence: .sisyphus/evidence/task-11-opencode-fallback.txt

  Scenario: 전체 regression — 기존 OpenCode 테스트 100% 통과
    Tool: Bash (npx vitest run)
    Preconditions: 모든 수정 완료
    Steps:
      1. npx vitest run --reporter=verbose
      2. 실패한 테스트 0개 확인
    Expected Result: 전체 PASS
    Failure Indicators: 어떤 테스트든 FAIL
    Evidence: .sisyphus/evidence/task-11-full-regression.txt
  ```

  **Commit**: YES
  - Message: `refactor(opencode): apply .context/ fallback to OpenCode entry point`
  - Files: `src/index.ts`, `src/index.test.ts`
  - Pre-commit: `npx vitest run`

- [x] 12. CLI install omx 커맨드 TDD

  **What to do**:
  - `src/cli/commands/install.ts` 생성:
    - `context install omx` 서브커맨드 구현
    - 로직:
      1. OMX 플러그인 빌드 파일 경로 해석: `node_modules/@ksm0709/context/dist/omx/index.mjs` (또는 글로벌 설치 시 패키지 루트에서)
      2. 대상 디렉토리 `.omx/hooks/` 존재 확인. 없으면 생성
      3. 소스 파일을 `.omx/hooks/context.mjs`로 복사
      4. 이미 존재하면 덮어쓰기 (최신 버전으로 갱신)
      5. 성공 메시지: "Installed context plugin to .omx/hooks/context.mjs"
    - 소스 파일 해석 전략: `require.resolve('@ksm0709/context/omx')` 또는 `__dirname` 기반으로 `dist/omx/index.mjs` 찾기
  - `src/cli/commands/install.test.ts` 생성 — TDD:
    - 정상 설치 — `.omx/hooks/context.mjs` 생성 확인
    - `.omx/hooks/` 미존재 시 자동 생성
    - 이미 존재할 때 덮어쓰기 (갱신)
    - 소스 파일 미발견 시 에러 메시지
  - `src/cli/index.ts` — `install` 서브커맨드 추가 (기존 `update`, `migrate` 패턴 따라)

  **Must NOT do**:
  - symlink 사용 금지 — plain copy로 통일 (OMX가 `.mjs` 파일을 직접 실행하므로 symlink은 환경에 따라 동작하지 않을 수 있음)
  - postinstall hook 사용 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CLI 커맨드 TDD. 파일 경로 해석 + 복사 + 에러 핸들링
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 13)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 8, 10

  **References**:

  **Pattern References**:
  - `src/cli/index.ts` — CLI 진입점. 서브커맨드 라우팅 패턴
  - `src/cli/commands/update.ts` — 기존 CLI 커맨드 구현 패턴 (함수 시그니처, stdout 출력, exit code)
  - `src/cli/commands/migrate.ts` (Task 9) — migrate 커맨드의 파일시스템 조작 패턴

  **API/Type References**:
  - `node:fs` — `cpSync`, `mkdirSync`, `existsSync`
  - `node:path` — `join`, `dirname`
  - `node:url` — `fileURLToPath` (ESM에서 `__dirname` 대체)

  **Test References**:
  - `src/cli/commands/update.test.ts` — CLI 커맨드 단위 테스트 패턴
  - `src/cli/commands/migrate.test.ts` (Task 9) — 파일 복사/생성 테스트 패턴

  **WHY Each Reference Matters**:
  - `cli/index.ts` — `install` 서브커맨드를 기존 라우팅에 추가할 정확한 위치
  - `commands/update.ts` — CLI 함수의 시그니처와 출력 패턴을 일관되게 따라야 함

  **Acceptance Criteria**:

  **TDD:**
  - [ ] Test file created: `src/cli/commands/install.test.ts`
  - [ ] `npx vitest run install` → PASS (4+ tests, 0 failures)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: context install omx — 정상 설치
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .omx/ 없음, 소스 파일 경로에 mock .mjs 파일 준비
    Steps:
      1. install 함수 호출 (projectDir: tmpDir)
      2. join(tmpDir, '.omx', 'hooks', 'context.mjs') 존재 확인
      3. 파일 내용이 소스 파일과 동일한지 확인
    Expected Result: .omx/hooks/context.mjs 생성됨
    Failure Indicators: 파일 미생성 또는 내용 불일치
    Evidence: .sisyphus/evidence/task-12-install-omx-success.txt

  Scenario: .omx/hooks/ 미존재 시 디렉토리 자동 생성
    Tool: Bash (npx vitest run)
    Preconditions: tmpdir에 .omx/ 디렉토리 없음
    Steps:
      1. install 함수 호출
      2. join(tmpDir, '.omx', 'hooks') 디렉토리 존재 확인
      3. context.mjs 파일 존재 확인
    Expected Result: 디렉토리 + 파일 모두 생성
    Failure Indicators: ENOENT 에러 또는 디렉토리 미생성
    Evidence: .sisyphus/evidence/task-12-install-omx-mkdir.txt

  Scenario: 이미 설치된 상태에서 재설치 (갱신)
    Tool: Bash (npx vitest run)
    Preconditions: .omx/hooks/context.mjs 이미 존재 (구버전 내용)
    Steps:
      1. install 함수 호출
      2. context.mjs 내용이 최신 소스로 갱신되었는지 확인
    Expected Result: 기존 파일 덮어쓰기 (갱신)
    Failure Indicators: 구버전 내용 유지
    Evidence: .sisyphus/evidence/task-12-install-omx-update.txt

  Scenario: 소스 파일 미발견 시 에러 메시지
    Tool: Bash (npx vitest run)
    Preconditions: 소스 파일 경로에 파일 없음
    Steps:
      1. install 함수 호출 (소스 경로가 잘못된 상태)
      2. 에러 메시지 출력 확인
      3. exit code 1 확인
    Expected Result: 명확한 에러 메시지 + 비정상 종료
    Failure Indicators: 크래시 (unhandled error) 또는 성공으로 오판
    Evidence: .sisyphus/evidence/task-12-install-omx-notfound.txt
  ```

  **Commit**: YES
  - Message: `feat(cli): add install omx command to deploy plugin to .omx/hooks/`
  - Files: `src/cli/commands/install.ts`, `src/cli/commands/install.test.ts`, `src/cli/index.ts`
  - Pre-commit: `npx vitest run install`

- [ ] 13. architecture.md + docs 업데이트

  **What to do**:
  - `docs/architecture.md` 업데이트:
    - "Plugin Entry Point" 섹션에 OMX 엔트리포인트 설명 추가
    - 디렉토리 구조에 `src/omx/` 추가
    - `.opencode/context/` 경로 참조를 `.context/`로 변경 (fallback 언급)
    - Scaffold System 섹션에 `.context/` + fallback 동작 설명
  - `docs/omx-setup.md` 신규 생성 — OMX 사용자를 위한 설정 가이드:
    - 설치 방법: `npm install @ksm0709/context`
    - `.omx/hooks/` 에 플러그인 파일 배치 방법
    - `OMX_HOOK_PLUGINS=1` 환경변수 설정
    - 동작 설명: session-start 시 AGENTS.md 자동 갱신
    - `.context/` 설정 커스터마이징
  - `README.md` — OMX 지원 언급 추가 (간략하게, 상세는 omx-setup.md로 링크)
  - 기존 docs에서 `.opencode/context/` 하드코딩된 참조를 `.context/`로 업데이트 (architecture.md 중심)

  **Must NOT do**:
  - 기존 문서의 전체 재구조화 금지 — 필요한 부분만 업데이트
  - 기존 ADR/decision/gotcha 노트 수정 금지 — 새 문서에서 [[wikilink]]로 참조만

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 순수 문서 작성/업데이트
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 12)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 8, 9, 10, 11, 12

  **References**:

  **Pattern References**:
  - `docs/architecture.md` — 기존 문서 구조. 섹션 패턴을 따라 OMX 관련 내용 추가
  - `docs/adr-003-omx-compatibility.md` (Task 4) — OMX 호환성 ADR. [[wikilink]]로 참조

  **External References**:
  - `https://github.com/Yeachan-Heo/oh-my-codex/blob/main/docs/hooks-extension.md` — OMX 공식 문서. omx-setup.md에서 링크

  **WHY Each Reference Matters**:
  - `architecture.md` — 이 프로젝트의 "진실의 원천" 문서. OMX 지원을 여기에 반영해야 향후 개발자가 전체 아키텍처를 이해
  - `adr-003` — OMX 호환성의 "왜"를 기록한 문서. architecture.md에서 참조

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: architecture.md에 OMX 엔트리포인트 설명 포함
    Tool: Bash (node)
    Preconditions: 문서 업데이트 완료
    Steps:
      1. docs/architecture.md 파일 읽기
      2. 'omx' 또는 'OMX' 또는 'oh-my-codex' 문자열 존재 확인
      3. 'src/omx/' 경로 언급 확인
      4. '.context/' 경로 언급 확인
    Expected Result: OMX 관련 내용이 architecture.md에 포함
    Failure Indicators: OMX 언급 없음
    Evidence: .sisyphus/evidence/task-12-architecture-md.txt

  Scenario: omx-setup.md 존재 및 핵심 섹션 포함
    Tool: Bash (node)
    Preconditions: 문서 작성 완료
    Steps:
      1. docs/omx-setup.md 파일 존재 확인
      2. '설치' 또는 'Installation' 섹션 존재 확인
      3. 'OMX_HOOK_PLUGINS' 문자열 존재 확인
      4. '.omx/hooks/' 문자열 존재 확인
    Expected Result: OMX 설정 가이드 완성
    Failure Indicators: 파일 미존재 또는 핵심 섹션 누락
    Evidence: .sisyphus/evidence/task-12-omx-setup-md.txt

  Scenario: 문서에서 .opencode/context/ 하드코딩이 .context/로 갱신됨
    Tool: Bash (grep)
    Preconditions: architecture.md 업데이트 완료
    Steps:
      1. docs/architecture.md에서 '.opencode/context/' 출현 횟수 카운트
      2. fallback 설명 맥락 외에서 '.opencode/context/'가 "현재 경로"로 참조되지 않는지 확인
    Expected Result: 주요 경로 참조가 .context/로 갱신, .opencode/context/는 fallback 설명에서만 등장
    Failure Indicators: .opencode/context/ 가 현재 기본 경로로 서술됨
    Evidence: .sisyphus/evidence/task-12-path-references.txt
  ```

  **Commit**: YES
  - Message: `docs: update architecture and add OMX setup guide`
  - Files: `docs/architecture.md`, `docs/omx-setup.md`, `README.md`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read `.sisyphus/plans/omx-compatibility.md` end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `npx vitest run` + `mise run lint` + `mise run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod (eslint no-console), commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify no `Bun.*` APIs in shared core or OMX entry.
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
      Start from clean state. Create temp project. Test: (1) Fresh scaffold creates `.context/`. (2) Fallback reads from `.opencode/context/`. (3) OMX `onHookEvent` injects into AGENTS.md. (4) CLI `context migrate` moves files. (5) `node --input-type=module` import of OMX build succeeds. (6) Edge cases: empty project, no docs/, AGENTS.md missing. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: `src/index.ts` unchanged, no `Bun.*` in shared modules, no OMX turn-end impl. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Type     | Scope    | Message                                                              | Files                                                                                 | Pre-commit                        |
| ------ | -------- | -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| 1      | fix      | deps     | `fix(deps): remove self-referential dependency`                      | `package.json`                                                                        | `npm install --dry-run`           |
| 2      | feat     | core     | `feat(core): add resolveContextDir with .context/ fallback`          | `src/lib/context-dir.ts`, `src/lib/context-dir.test.ts`                               | `npx vitest run context-dir`      |
| 3      | feat     | omx      | `feat(omx): add AGENTS.md marker injection module`                   | `src/omx/agents-md.ts`, `src/omx/agents-md.test.ts`                                   | `npx vitest run agents-md`        |
| 4      | docs     | arch     | `docs: add ADR-003 OMX compatibility + turn-end investigation`       | `docs/adr-003-*.md`, `docs/decision-omx-*.md`                                         | —                                 |
| 5      | refactor | core     | `refactor(core): migrate paths to .context/ with fallback`           | `src/constants.ts`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`                 | `npx vitest run`                  |
| 6      | refactor | core     | `refactor(core): apply resolveContextDir to config loading`          | `src/lib/config.ts`, `src/lib/config.test.ts`                                         | `npx vitest run config`           |
| 7      | refactor | core     | `refactor(core): update DEFAULT_CONFIG/prompts to .context/ paths`   | `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`                                     | `npx vitest run scaffold`         |
| 8      | feat     | omx      | `feat(omx): add OMX plugin entry point`                              | `src/omx/index.ts`, `src/omx/index.test.ts`                                           | `npx vitest run omx`              |
| 9      | feat     | cli      | `feat(cli): add migrate command for .opencode → .context`            | `src/cli/commands/migrate.ts`, `src/cli/commands/migrate.test.ts`, `src/cli/index.ts` | `npx vitest run migrate`          |
| 10     | build    | pkg      | `build: add OMX multi-entry export and build target`                 | `package.json`, build scripts                                                         | `mise run build && node ESM test` |
| 11     | refactor | opencode | `refactor(opencode): apply .context/ fallback to OpenCode entry`     | `src/index.ts`, `src/index.test.ts`                                                   | `npx vitest run`                  |
| 12     | feat     | cli      | `feat(cli): add install omx command to deploy plugin to .omx/hooks/` | `src/cli/commands/install.ts`, `src/cli/commands/install.test.ts`, `src/cli/index.ts` | `npx vitest run install`          |
| 13     | docs     | —        | `docs: update architecture and add OMX setup guide`                  | `docs/architecture.md`, `docs/omx-setup.md`, `README.md`                              | —                                 |

---

## Success Criteria

### Verification Commands

```bash
npx vitest run                    # Expected: ALL tests pass
mise run build                    # Expected: dist/index.js + dist/omx/index.mjs both created
mise run lint                     # Expected: 0 errors
node --input-type=module -e "import('./dist/omx/index.mjs').then(m => { if (typeof m.onHookEvent !== 'function') process.exit(1) })"  # Expected: exit 0
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (`npx vitest run`)
- [ ] Build succeeds (`mise run build`)
- [ ] Lint clean (`mise run lint`)
- [ ] OMX build is valid ESM
- [ ] OpenCode backward compatibility — existing tests unmodified and passing
