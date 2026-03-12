## 2026-03-12

- RED contract tests in `src/index.test.ts` now lock the simplified prompt behavior: turn-start stays on the last user message with colocated `## Available Knowledge`, turn-end stays a separate `<system-reminder>` user message only when non-empty, and injected shipped prompt text must not contain `subagent`, `task(`, `서브에이전트`, or `위임`.
- Running `npx vitest run src/index.test.ts` fails in RED against current runtime because shipped prompt templates still inject delegation wording into both turn-start and turn-end content.
- Expanded the RED contract to cover empty `messages`, no user message, missing prompt files, empty `turn-end.md`, and a subagent-session case that must still avoid any delegated or subagent-specific injected prompt text while preserving the same injection structure.
- Shipped prompt assets in `.opencode/context/prompts/turn-start.md` and `.opencode/context/prompts/turn-end.md` can be simplified without changing injection placement by keeping only direct main-agent instructions for knowledge reading, QA, and note recording.
- Scaffold defaults in `src/lib/scaffold.ts` must match shipped prompt assets exactly, while existing installs keep customized prompt files until `context update prompt` explicitly refreshes them.
- `src/lib/scaffold.test.ts` can lock the migration stance by proving `autoUpdateTemplates()` leaves legacy prompt files untouched and `updatePrompts()` is the deliberate refresh path for new default wording.
- Prompt rewrites for this task should keep the same injection structure but make the main agent explicitly responsible for reading `Available Knowledge`, rerunning closing QA checks, and recording findings directly.
- The manual-refresh migration stance belongs in both shipped prompt content and active docs so users see the same rule in generated files and `docs/architecture.md`.
- Runtime cleanup can remove the entire `tool.execute.before` hook without changing prompt injection semantics because the only remaining behavior lives in `experimental.chat.messages.transform`.
- `ContextConfig`, `loadConfig()`, and scaffolded default config no longer need any `subagentConfig` surface once prompt filtering and orchestration blocking are deleted.
- After deleting `src/lib/subagent-detector.ts` and `src/lib/prompt-filter.ts`, the remaining subagent-runtime audit should only hit assertion strings in tests that verify the removed surface stays absent.
- Cleanup for Task 4 should delete session/subagent-specific runtime assertions from `src/index.test.ts` and replace them with direct contract checks for empty turn-start plus empty knowledge content, so GREEN coverage stays aligned with the simplified `messages.transform` path only.
- GREEN cleanup for `src/index.test.ts` should treat missing prompt files as a knowledge-only path when `AGENTS.md` or other configured knowledge exists, because the runtime still appends `## Available Knowledge` even without prompt markdown.
- `src/lib/config.test.ts` is cleaner when it locks the active prompt contract via exact `prompts` keys (`turnStart`, `turnEnd`) instead of asserting removal of legacy subagent fields by name.

- Task 4 GREEN cleanup replaced verbose runtime coverage in  with 12 contract-focused cases that cover the retained hook surface only: missing prompt files, empty turn-start/turn-end content, hot-reload behavior, knowledge-only injection, and non-synthetic turn-start/turn-end messages.
- Active test files no longer import deleted subagent helper modules, and the only remaining  /  strings in tests are negative assertions or deliberate legacy-fixture refresh checks in .

- Task 4 GREEN cleanup replaced verbose runtime coverage in src/index.test.ts with 12 contract-focused cases that cover the retained hook surface only: missing prompt files, empty turn-start/turn-end content, hot-reload behavior, knowledge-only injection, and non-synthetic turn-start/turn-end messages.
- Active test files no longer import deleted subagent helper modules, and the only remaining subagent / task( strings in tests are negative assertions or deliberate legacy-fixture refresh checks in src/lib/scaffold.test.ts.
## Findings: Subagent Removal
- Removed subagent delegation from prompt flow.
- Moved obsolete subagent-specific decision notes to docs/archive/subagent/.
- Updated docs/architecture.md to reflect the new injection model.
- Updated docs/INDEX.md to reflect the changes.
- Note: Some references to subagent-related decisions remain in other docs (e.g., insight-opencode-plugin-loading-debugging.md, gotcha-bun-html-comment-template-literal.md) as historical context, which is acceptable.

## 2026-03-12 Final Validation
- Final verification passed for executable checks: `npx vitest run` succeeded, `mise run build` succeeded, and `lsp_diagnostics` was clean for `src/index.ts`, `src/cli/index.ts`, `src/lib/scaffold.ts`, `src/index.test.ts`, and `src/lib/scaffold.test.ts`.
- Repo audit is clean for active runtime and shipped prompt assets after rebuilding: `src/` no longer contains subagent runtime hooks beyond negative test assertions, `.opencode/context/prompts/` is free of delegation wording, and rebuilt `dist/*.js` is free of `subagent`, `task(`, `primary-only`, and `subagent-only`.
- Installed fallback verification must target `~/.config/opencode/node_modules/@ksm0709/context/dist/` directly, not cache metadata. Before an explicit rebuild+copy, the installed fallback still contained old subagent code; after rebuilding both plugin and CLI dist and syncing `dist/` into the installed package, grep against the installed `dist/*.js` became clean.
- Existing-install prompt refresh verification should be exercised with the installed CLI path itself: `bun ~/.config/opencode/node_modules/@ksm0709/context/dist/cli/index.js update prompt <path>`. That command rewrote legacy prompt files, removed subagent wording from both prompts, and preserved the explicit refresh note in `turn-end.md`.
- Audit caveat: `docs/` still contains historical subagent references outside `docs/archive/subagent/` (for example `docs/pattern-d8-prompt-markers.md` and `docs/insight-opencode-plugin-loading-debugging.md`), so a strict repo-wide docs grep still reports historical mentions even though active runtime/build artifacts are clean.
