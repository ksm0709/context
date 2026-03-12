# Remove Subagent Prompt Flow

## TL;DR

> **Summary**: `turn-start`와 `turn-end`에서 subagent 사용을 완전히 제거하고, 비-subagent 컨텍스트 주입 동작만 유지한다. 런타임의 subagent 감지/필터/차단 경로와 관련 설정, 테스트, 활성 문서를 함께 정리한다.
> **Deliverables**:
>
> - subagent-free prompt/runtime design plan
> - runtime/config/test/doc cleanup sequence
> - cache-aware verification procedure
>   **Effort**: Medium
>   **Parallel**: YES - 4 waves
>   **Critical Path**: 1 -> 3 -> 4 -> 6

## Context

### Original Request

- `turn-start`, `turn-end` 모두에서 subagent 사용 자체를 하지 않도록 수정하는 계획 파일 작성.

### Interview Summary

- 사용자 최신 의도는 부분 롤백이 아니라 subagent usage 전체 제거다.
- 유지할 것은 비-subagent 컨텍스트 주입 동작뿐이다.
- 현재 구조는 `src/index.ts`에서 `turn-start`를 마지막 user message에 append하고 `turn-end`를 별도 `<system-reminder>` user message로 push한다.
- 실제 디버깅 중 primary-only `turn-end` 내용이 세션에 남는 것이 관찰되었고, 이것이 subagent contamination의 핵심 배경으로 확인되었다.

### Metis Review (gaps addressed)

- 기존 설치의 `.opencode/context/prompts/*.md`는 scaffold default 변경만으로 자동 갱신되지 않으므로, 계획에 `context update prompt` 기반 마이그레이션/검증을 포함한다.
- subagent 관련 decision/pattern 노트가 `docs/`에 남아 있으면 default knowledge injection에 계속 노출될 수 있으므로, active knowledge에서 제외하는 정리 작업을 계획에 포함한다.
- 이 작업은 injection architecture 재설계가 아니라 behavior-preserving refactor로 제한한다.

## Work Objectives

### Core Objective

- prompt, runtime, config, tests, active knowledge에서 subagent 의존성을 제거하면서 기존 non-synthetic message injection 구조는 유지한다.

### Deliverables

- `src/index.ts` 단순화 계획 (`messages.transform`만 남기고 subagent-aware branches 제거)
- prompt/scaffold/config/types 정리 계획
- obsolete unit/integration test 제거 및 replacement test 계획
- active docs/knowledge 정리 계획
- 실제 로드 plugin dist 경로까지 포함한 verification 절차

### Definition of Done

- `npx vitest run` 통과
- `mise run build` 통과
- repo audit에서 active code/prompt/test/doc에 subagent delegation 지시가 남지 않음
- 실제 로드 대상 경로인 `~/.config/opencode/node_modules/@ksm0709/context/dist/index.js` 기준으로 subagent-free 동작 검증 절차가 완료됨
- 기존 non-subagent injection semantics는 유지됨:
  - `turn-start`는 마지막 user message에 append
  - knowledge index는 `turn-start`와 같은 text 흐름에 co-located
  - `turn-end`는 content가 있을 때만 별도 `<system-reminder>` user message로 주입

### Must Have

- TDD 순서 고정: RED -> implementation -> GREEN
- subagent detector/filter/tool blocking/config 제거
- shipped prompt assets와 scaffold defaults에서 delegation 문구 제거
- active docs에서 subagent를 현재 설계로 설명하는 내용 제거
- cache-aware runtime verification 포함

### Must NOT Have

- synthetic/non-synthetic semantics 변경 금지
- knowledge index 포맷 재설계 금지
- unrelated CLI architecture refactor 금지
- subagent delegation을 `turn-start` 또는 `turn-end` 어느 한쪽에도 남기지 않음
- obsolete docs를 active knowledge에 그대로 남겨 기본 injection에 노출시키지 않음

## Verification Strategy

> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- Test decision: tests-after with RED-first updates using Vitest
- QA policy: Every task includes agent-executed scenarios with exact commands or grep assertions
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

> Target: 5-8 tasks per wave where possible. This work has 6 main tasks plus final verification.

Wave 1: contract locking

- Task 1: RED tests for simplified prompt/runtime contract

Wave 2: behavior cleanup

- Task 2: rewrite shipped prompt templates + scaffold defaults
- Task 3: remove subagent-aware runtime/config/type branches

Wave 3: stabilization

- Task 4: replace/delete obsolete tests and bring suite GREEN
- Task 5: update active docs/knowledge and archive obsolete subagent notes outside `docs/`

Wave 4: final verification

- Task 6: build, repo audit, installed-dist verification

### Dependency Matrix (full)

| Task | Depends On | Blocks                  |
| ---- | ---------- | ----------------------- |
| 1    | none       | 2, 3                    |
| 2    | 1          | 3, 5                    |
| 3    | 1, 2       | 4, 5                    |
| 4    | 3          | 6                       |
| 5    | 2, 3       | 6                       |
| 6    | 4, 5       | Final Verification Wave |

### Agent Dispatch Summary

- Wave 1 -> 1 task -> `deep`
- Wave 2 -> 2 tasks -> `deep`, `ultrabrain`
- Wave 3 -> 2 tasks -> `deep`, `writing`
- Wave 4 -> 1 task -> `deep`

## TODOs

> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Lock the simplified prompt contract with RED tests

  **What to do**: Update `src/index.test.ts` so the desired post-change behavior is explicitly captured before implementation. Preserve turn-start append, knowledge co-location, turn-end `<system-reminder>` injection, empty/missing graceful handling, and the absence of subagent-specific output. Add negative assertions that no injected prompt text contains subagent delegation wording.
  **Must NOT do**: Do not change runtime code in this task. Do not delete old tests before new contract tests exist.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: regression contract must be locked precisely before code deletion
  - Skills: [`opencode-plugin-dev`] — plugin hook semantics and transform behavior are central
  - Omitted: [`technical-writer`] — wording is secondary to executable assertions

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3 | Blocked By: none

  **References**:
  - Pattern: `src/index.ts` — current message transform flow to preserve
  - Test: `src/index.test.ts` — existing transform tests and obsolete subagent-aware cases
  - Doc: `docs/architecture.md` — preserved turn-start + knowledge co-location semantics
  - Doc: `docs/synthetic-message-injection.md` — do not change non-synthetic injection semantics

  **Acceptance Criteria**:
  - [ ] `npx vitest run src/index.test.ts` initially fails because new no-subagent expectations are not yet implemented
  - [ ] Tests assert that the last user message receives `turn-start` plus `## Available Knowledge`
  - [ ] Tests assert that `turn-end` is injected as a separate user message only when prompt content is non-empty
  - [ ] Tests assert that injected text does not contain `subagent`, `task(`, or delegation wording from shipped prompts

  **QA Scenarios**:

  ```text
  Scenario: Happy path contract is locked
    Tool: Bash
    Steps: Run `npx vitest run src/index.test.ts`
    Expected: RED failure occurs on new no-subagent assertions before implementation
    Evidence: .sisyphus/evidence/task-1-lock-contract.txt

  Scenario: Edge cases are captured
    Tool: Read
    Steps: Inspect `src/index.test.ts` and confirm explicit cases for empty messages, no user message, missing prompt file, and empty turn-end file
    Expected: All four edge cases exist as executable tests
    Evidence: .sisyphus/evidence/task-1-lock-contract-edge.txt
  ```

  **Commit**: NO | Message: `test(context): lock subagent-free prompt contract` | Files: [`src/index.test.ts`]

- [x] 2. Rewrite shipped prompt templates and scaffold defaults

  **What to do**: Rewrite `.opencode/context/prompts/turn-start.md` and `.opencode/context/prompts/turn-end.md` to remove all subagent delegation, `task(...)` examples, `primary-only` / `subagent-only` markers, and worker-only guidance. Update scaffolded defaults in `src/lib/scaffold.ts` so fresh installs generate the same subagent-free content. Keep direct instructions for reading knowledge, performing QA, and recording findings as main-agent actions.
  **Must NOT do**: Do not change prompt injection placement. Do not keep fallback subagent wording “for advanced users”.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: prompt content and scaffold defaults must stay behaviorally aligned
  - Skills: [`opencode-plugin-dev`] — scaffold behavior and prompt asset packaging matter
  - Omitted: [`technical-writer`] — useful but not necessary for concise operational prompt rewrites

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 3, 5 | Blocked By: 1

  **References**:
  - Pattern: `.opencode/context/prompts/turn-start.md` — current delegation-heavy content to replace
  - Pattern: `.opencode/context/prompts/turn-end.md` — current `<system-reminder>` content to simplify
  - Pattern: `src/lib/scaffold.ts` — shipped default prompt strings and config template
  - Doc: `AGENTS.md` — TDD/Vitest/build constraints

  **Acceptance Criteria**:
  - [ ] Default prompt assets contain no `task(`, `subagent`, `primary-only`, or `subagent-only`
  - [ ] `src/lib/scaffold.test.ts` or equivalent coverage validates the new scaffold output
  - [ ] Prompt wording still tells the main agent to read knowledge and perform closing checks directly
  - [ ] Planned migration stance is implemented in docs and verification: existing installs require explicit prompt refresh via `context update prompt`

  **QA Scenarios**:

  ```text
  Scenario: Shipped prompts are subagent-free
    Tool: Grep
    Steps: Search `.opencode/context/prompts/*.md` and `src/lib/scaffold.ts` for `subagent|task\(|primary-only|subagent-only`
    Expected: No matches in active prompt assets or scaffold defaults
    Evidence: .sisyphus/evidence/task-2-rewrite-prompts.txt

  Scenario: Existing-install migration is explicit
    Tool: Read
    Steps: Inspect updated docs and tests for the rule that existing prompt files are not auto-rewritten and must be refreshed deliberately
    Expected: Migration stance is stated once and consistently
    Evidence: .sisyphus/evidence/task-2-rewrite-prompts-migration.txt
  ```

  **Commit**: NO | Message: `refactor(context): remove subagent wording from shipped prompts` | Files: [`.opencode/context/prompts/turn-start.md`, `.opencode/context/prompts/turn-end.md`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`]

- [ ] 3. Remove subagent-aware runtime, config, and types

  **What to do**: Simplify `src/index.ts` to a single non-subagent path. Remove `tool.execute.before` orchestration blocking, `isSubagentSession`, `filterByAgentType`, `subagentCache`, `getSession`, and `logSubagentDetectionFailure`. Remove `subagentConfig` from `src/types.ts`, `src/lib/config.ts`, and default config generation. Delete obsolete helper modules if no remaining references exist.
  **Must NOT do**: Do not alter the turn-start append location, knowledge index build, or `<system-reminder>` wrapping behavior.

  **Recommended Agent Profile**:
  - Category: `ultrabrain` — Reason: highest logic/deletion risk with cross-file surface cleanup
  - Skills: [`opencode-plugin-dev`] — plugin hook API and config surface must remain valid
  - Omitted: [`senior-architect`] — redesign is out of scope

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4, 5 | Blocked By: 1, 2

  **References**:
  - Pattern: `src/index.ts` — current hook registration and transform logic
  - API/Type: `src/types.ts` — `subagentConfig` surface to remove
  - Pattern: `src/lib/config.ts` — merge/default logic to simplify
  - Pattern: `src/lib/subagent-detector.ts` — helper likely removable
  - Pattern: `src/lib/prompt-filter.ts` — helper likely removable

  **Acceptance Criteria**:
  - [ ] `src/index.ts` no longer imports or references subagent detector/filtering/blocked tool logic
  - [ ] `src/types.ts` and `src/lib/config.ts` no longer expose `subagentConfig`
  - [ ] `src/lib/subagent-detector.ts` and `src/lib/prompt-filter.ts` are deleted, or a repo-wide reference audit proves they are unused
  - [ ] `messages.transform` still injects turn-start and turn-end with preserved semantics

  **QA Scenarios**:

  ```text
  Scenario: Runtime is simplified but behavior remains
    Tool: Bash
    Steps: Run `npx vitest run src/index.test.ts src/lib/config.test.ts src/lib/scaffold.test.ts`
    Expected: Changed runtime/config/scaffold tests pass
    Evidence: .sisyphus/evidence/task-3-remove-runtime.txt

  Scenario: No active subagent runtime references remain
    Tool: Grep
    Steps: Search `src/**/*.ts` for `isSubagentSession|filterByAgentType|subagentConfig|tool.execute.before|Failed to detect subagent session`
    Expected: No matches outside intentionally updated historical tests/docs if any remain
    Evidence: .sisyphus/evidence/task-3-remove-runtime-audit.txt
  ```

  **Commit**: NO | Message: `refactor(context): remove subagent-aware runtime paths` | Files: [`src/index.ts`, `src/types.ts`, `src/lib/config.ts`, `src/lib/subagent-detector.ts`, `src/lib/prompt-filter.ts`, `src/lib/config.test.ts`]

- [ ] 4. Replace obsolete tests and bring the suite GREEN

  **What to do**: Remove tests that only protect deleted subagent behavior (`subagent filtering`, `tool blocking`, `detection fallback warning`) and keep only the simplified runtime contract. Add any missing GREEN-path tests for missing prompt files, empty prompt content, and scaffold/config defaults after cleanup.
  **Must NOT do**: Do not leave dead tests that reference deleted modules or stale behavior for “historical” reasons.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: suite must be re-centered on externally visible behavior
  - Skills: [`opencode-plugin-dev`] — plugin tests should track hook-level public behavior
  - Omitted: [`code-review-excellence`] — not needed for execution

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 6 | Blocked By: 3

  **References**:
  - Test: `src/index.test.ts` — delete/replace subagent-specific cases
  - Test: `src/lib/subagent-detector.test.ts` — remove if module deleted
  - Test: `src/lib/prompt-filter.test.ts` — remove if module deleted
  - Test: `src/lib/config.test.ts`, `src/lib/scaffold.test.ts` — update default expectations

  **Acceptance Criteria**:
  - [ ] `npx vitest run` passes
  - [ ] No active test imports deleted subagent helper modules
  - [ ] Coverage for changed code paths is centered on retained runtime behavior, not removed internals
  - [ ] No fixture text in active tests includes old delegation wording unless explicitly asserting removal

  **QA Scenarios**:

  ```text
  Scenario: Full suite is GREEN
    Tool: Bash
    Steps: Run `npx vitest run`
    Expected: All tests pass with no skipped replacements for deleted subagent behavior
    Evidence: .sisyphus/evidence/task-4-green-suite.txt

  Scenario: Dead test imports are gone
    Tool: Grep
    Steps: Search `src/**/*.test.ts` for `subagent-detector|prompt-filter|Failed to detect subagent session|Subagents are not allowed`
    Expected: No matches in active tests
    Evidence: .sisyphus/evidence/task-4-green-suite-audit.txt
  ```

  **Commit**: NO | Message: `test(context): remove obsolete subagent coverage` | Files: [`src/index.test.ts`, `src/lib/subagent-detector.test.ts`, `src/lib/prompt-filter.test.ts`, `src/lib/config.test.ts`, `src/lib/scaffold.test.ts`]

- [ ] 5. Update active docs and remove stale subagent knowledge from default injection

  **What to do**: Update `docs/architecture.md` to describe only the non-subagent injection model. Create one new superseding decision note that states subagent usage was removed from prompt flow. Move obsolete subagent-specific decision/pattern notes out of `docs/` into a non-indexed archive location so they stop appearing in default knowledge injection. Update any surviving wikilinks and `docs/INDEX.md` accordingly.
  **Must NOT do**: Do not leave old subagent notes inside `docs/` marked only as “deprecated”; the knowledge index scans `docs/` recursively, so they would still contaminate injected knowledge.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this is documentation and knowledge hygiene with architectural consequences
  - Skills: [`technical-writer`, `opencode-plugin-dev`] — clear doc updates plus plugin-accurate statements
  - Omitted: [`agent-md-refactor`] — not a broad AGENTS refactor

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 6 | Blocked By: 2, 3

  **References**:
  - Doc: `docs/architecture.md` — active architecture description
  - Doc: `docs/decision-turn-start-subagent-delegation.md` — obsolete active decision
  - Doc: `docs/decision-subagent-infinite-loop-prevention.md` — obsolete active decision
  - Doc: `docs/decision-subagent-session-detection.md` — obsolete active decision
  - Doc: `docs/pattern-d8-prompt-markers.md` — obsolete active pattern for prompt filtering
  - Doc: `docs/INDEX.md` — active knowledge index entry surface

  **Acceptance Criteria**:
  - [ ] `docs/architecture.md` no longer describes subagent-aware prompt behavior as current design
  - [ ] A superseding decision note exists in `docs/` for the new subagent-free direction
  - [ ] Obsolete subagent docs are moved outside `docs/` so default knowledge scanning no longer includes them
  - [ ] `docs/INDEX.md` and surviving wikilinks are consistent after archival/move

  **QA Scenarios**:

  ```text
  Scenario: Active knowledge is subagent-free
    Tool: Grep
    Steps: Search `docs/**/*.md` and `AGENTS.md` for active delegation phrases such as `서브에이전트에 위임`, `subagent`, and `task(` after excluding archive paths outside `docs/`
    Expected: No active knowledge docs describe subagent delegation as current behavior
    Evidence: .sisyphus/evidence/task-5-docs-audit.txt

  Scenario: Historical notes are preserved but not injected
    Tool: Read
    Steps: Inspect the new superseding decision note, the moved archive location, and `docs/INDEX.md`
    Expected: History remains discoverable by link, but default knowledge scanning no longer includes obsolete subagent notes
    Evidence: .sisyphus/evidence/task-5-docs-archive.txt
  ```

  **Commit**: NO | Message: `docs(context): supersede subagent prompt-flow decisions` | Files: [`docs/architecture.md`, `docs/INDEX.md`, `docs/decision-*.md`, `docs/pattern-d8-prompt-markers.md`]

- [ ] 6. Run final build, audits, and installed-dist verification

  **What to do**: Execute final validation across source, tests, build output, and the actually loadable plugin path. Sync the installed fallback dist as needed, then verify behavior against `~/.config/opencode/node_modules/@ksm0709/context/dist/index.js` instead of trusting cache version strings. Include prompt refresh verification for an existing-install scenario.
  **Must NOT do**: Do not use `opencode run` for verification. Do not treat stale `~/.cache/opencode/package.json` metadata as proof of runtime behavior.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: source, build, cache, and installed-dist behavior all must align
  - Skills: [`opencode-plugin-dev`] — plugin loading gotchas and installed-dist verification are central
  - Omitted: [`git-master`] — verification is separate from commit flow

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: Final Verification Wave | Blocked By: 4, 5

  **References**:
  - Doc: `docs/insight-opencode-plugin-loading-debugging.md` — actual plugin load path and stale cache warning
  - Doc: `docs/gotcha-opencode-plugin-cache-version-mismatch.md` — do not trust cache metadata
  - Doc: `docs/runbook-context-plugin-release.md` — cache sync procedure patterns
  - Build: `AGENTS.md` — use `mise run build` / `npx vitest run`

  **Acceptance Criteria**:
  - [ ] `npx vitest run` passes
  - [ ] `mise run build` passes
  - [ ] Repo audit shows no active subagent delegation in code, shipped prompt assets, tests, or active docs
  - [ ] Installed-dist verification against `~/.config/opencode/node_modules/@ksm0709/context/dist/index.js` confirms the simplified behavior and absence of subagent wording
  - [ ] Existing-install verification includes an explicit `context update prompt` or equivalent prompt refresh step and re-checks prompt contents

  **QA Scenarios**:

  ```text
  Scenario: Final source/build verification
    Tool: Bash
    Steps: Run `npx vitest run && mise run build`
    Expected: Both commands succeed with no failing tests or build errors
    Evidence: .sisyphus/evidence/task-6-final-verify.txt

  Scenario: Installed plugin path matches expected behavior
    Tool: Bash
    Steps: Sync the built plugin to `~/.config/opencode/node_modules/@ksm0709/context/`, then run an automated verification harness or focused test/import against `~/.config/opencode/node_modules/@ksm0709/context/dist/index.js`; separately grep refreshed prompt files for `subagent|task\(|primary-only|subagent-only`
    Expected: Installed dist exposes the simplified behavior and refreshed prompt assets contain no subagent wording
    Evidence: .sisyphus/evidence/task-6-final-installed.txt
  ```

  **Commit**: NO | Message: `build(context): verify installed dist after subagent removal` | Files: [`dist/`, installed plugin sync path, verification notes]

## Final Verification Wave (4 parallel agents, ALL must APPROVE)

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy

- Single final commit after Wave 4 and final verification.
- Commit message: `refactor(context): remove subagent prompt-flow behavior`
- Do not create intermediate commits unless a blocking rollback point is required during execution.

## Success Criteria

- Active prompt flow no longer instructs or depends on subagents anywhere in shipped assets or runtime.
- `turn-start` append, knowledge co-location, and `turn-end` `<system-reminder>` injection remain intact.
- subagent detector/filter/blocking modules and config surface are removed.
- active knowledge injection no longer surfaces obsolete subagent-oriented decisions.
- test/build/runtime verification all pass against both source and actually loaded installed dist.
