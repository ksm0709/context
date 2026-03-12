## [2026-03-10] Atlas Init: Codebase Analysis

### 🔴 CRITICAL FINDING: filterPromptForAgent already exists in prompt-reader.ts!

- `src/lib/prompt-reader.ts` lines 16-42 has `filterPromptForAgent(content, isSubagent)`
- This is **identical logic** to what Task 1 plans as `filterByAgentType`
- BUT: `prompt-reader.ts` MUST NOT be modified (plan constraint)
- Task 1 must create SEPARATE `prompt-filter.ts` with `filterByAgentType` (new file)
- `filterPromptForAgent` in `prompt-reader.ts` stays as dead code (acceptable per plan)

### Current State of index.ts (problem areas)

- Line 47-49: `session.agent` — Session type has NO `agent` field
- Line 100-101: `(lastUserMsg.info as any).agent` — unsafe, old detection
- Lines 103-109: turn-end path branching via `isSubagent` from agent name

### createMockInput in index.test.ts is MISSING client.session mock

- Line 10-19: `createMockInput` only has `client.app` — NO `client.session`
- Task 6 MUST add `client.session.get` mock or all new tests will TypeError

### subagentTurnEnd reference locations (for Tasks 3, 4, 5)

- `types.ts:5` — `subagentTurnEnd?: string` field
- `constants.ts:6` — `subagentTurnEndFile: 'subagent-turn-end.md'`
- `config.ts:12` — getDefaultConfig() subagentTurnEnd default path
- `config.ts:33` — mergeWithDefaults() subagentTurnEnd merge
- `scaffold.ts:14` — DEFAULT_CONFIG JSON literal string "subagentTurnEnd" key
- `scaffold.ts:173-179` — DEFAULT_SUBAGENT_TURN_END constant (remove → move content to turn-end subagent-only block)
- `scaffold.ts:426-430` — scaffoldIfNeeded() writeFileSync for subagent-turn-end.md
- `scaffold.ts:457` — updateScaffold() templates map entry
- `scaffold.ts:534` — updatePrompts() prompts map entry
- `index.ts:106-107` — turn-end path branching

### scaffold.test.ts expected changes

- Line 175: `toHaveLength(13)` → 12
- Line 184: `toHaveLength(13)` → 12
- Line 380: `toHaveLength(3)` → 2

### Wave 1 tasks (independent, can run in parallel):

- T1: Create src/lib/prompt-filter.ts + prompt-filter.test.ts
- T2: Create src/lib/subagent-detector.ts + subagent-detector.test.ts
- T3: Remove subagentTurnEnd from types.ts, constants.ts, config.ts
- T4: Add D8 markers to scaffold.ts templates, remove DEFAULT_SUBAGENT_TURN_END

## [Task 3] subagentTurnEnd removed from types/constants/config

- ContextConfig.prompts now only has turnStart, turnEnd
- DEFAULTS no longer has subagentTurnEndFile
- config.ts getDefaultConfig + mergeWithDefaults cleaned up

## [Task 2] subagent-detector.ts created

- isSubagentSession: async, parentID-based detection
- Cache is passed in as Map<string, boolean> — owned by caller
- fail-open: returns false on any error

## [Task 1] prompt-filter.ts created

- filterByAgentType implemented in src/lib/prompt-filter.ts
- Non-greedy regex for marker matching
- Pass-through for content with no markers
