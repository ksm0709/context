# Learnings

## [2026-02-25] Session Start
- Plugin API: `experimental.chat.system.transform` 훅으로 output.system 배열에 push
- 아키텍처: Flat (index.ts + lib/ 4개 모듈)
- Build: bun build + tsc --emitDeclarationOnly
- src/index.ts: export default만, named export 절대 금지
- console.log 금지 → client.app.log() 사용

## [Task 1 Complete]
- @opencode-ai/plugin version used: 1.2.12
- jsonc-parser version: 3.3.1
- src/types.ts: ContextConfig + KnowledgeEntry exported
- src/constants.ts: DEFAULTS + LIMITS exported
- Build: bun build ./src/index.ts --outdir dist --target bun (exit code 0)
- Type declarations: generated with tsc --declaration --emitDeclarationOnly --outDir dist --noEmit false

## [Task 2 Complete] Config Loader with TDD

### Patterns Used

1. **TDD Approach**: Tests written first, then implementation
   - 5 test cases covering: missing file, valid JSON, JSONC with comments, malformed JSON, partial config merging

2. **Graceful Degradation**: Config loader never throws
   - Returns default config on any error (file not found, malformed JSON, etc.)
   - Uses try-catch to handle all error cases

3. **JSONC Parsing**: Using `jsonc-parser` library
   - Handles comments in JSON files
   - Returns `undefined` on parse errors (not throws)

4. **Default Config Pattern**:
   ```typescript
   function getDefaultConfig(): ContextConfig { ... }
   function mergeWithDefaults(partial: Partial<ContextConfig>): ContextConfig { ... }
   ```

5. **Test Isolation**: Using tmpdir for test files
   - `beforeEach`: Create temp directory
   - `afterEach`: Clean up temp directory
   - Prevents test pollution

### Implementation Details

- Config path: `.opencode/context/config.jsonc` (from DEFAULTS.configPath)
- Default knowledge sources: `['AGENTS.md']`
- Default prompts: `.opencode/context/prompts/turn-start.md` and `turn-end.md`
- Merge strategy: Partial values override defaults, missing values use defaults

### Test Results

- 5 tests, 0 failures
- 17 expect() calls
- All edge cases covered


## Task 4: Prompt File Reader (TDD)

**Completed**: 2026-02-26

### Implementation
- Created `src/lib/prompt-reader.ts` with `readPromptFile(filePath: string): string`
- Uses `readFileSync` with UTF-8 encoding
- Truncates content exceeding 64KB (LIMITS.maxPromptFileSize)
- Returns empty string on file not found (no Error throw)

### Test Cases (4 tests)
1. Returns file content for existing file
2. Returns empty string when file does not exist
3. Truncates content exceeding 64KB (65537 chars → 65536)
4. Reads UTF-8 content correctly (Korean, Japanese, Emoji)

### Evidence
- `.sisyphus/evidence/task-4-prompt-reader.txt`
- `.sisyphus/evidence/task-4-prompt-fallback.txt`

### Key Decisions
- No caching: reads fresh each time
- No variable substitution: returns raw content
- Silent failure: returns '' instead of throwing

## Task 3: Knowledge Index Builder (TDD)

**Completed**: 2026-02-26

### Implementation
- Created `src/lib/knowledge-index.ts` with `buildKnowledgeIndex()` and `formatKnowledgeIndex()`
- `buildKnowledgeIndex(projectDir, sources)`: Scans directories recursively for .md files
- `formatKnowledgeIndex(entries)`: Formats entries as markdown list

### Test Cases (12 tests)
1. Returns empty array for non-existent source
2. Returns empty array for empty directory
3. Scans single .md file and returns entry with filename + summary
4. Ignores non-.md files (.txt, .jpg, .png)
5. Scans directory recursively up to depth 3
6. Does NOT scan beyond depth 3
7. Truncates summary to 100 chars
8. Skips empty first lines and finds first non-empty line
9. Limits entries to maxIndexEntries (100)
10. Formats entries as markdown list
11. Returns empty string for empty entries
12. Handles entries without summary

### Evidence
- `.sisyphus/evidence/task-3-index-scan.txt`
- `.sisyphus/evidence/task-3-index-limit.txt`

### Key Patterns

1. **Recursive Directory Scanning with Depth Control**
   - scanDir() uses depth parameter starting at 1
   - Stops recursion when depth > LIMITS.maxScanDepth (3)

2. **Entry Limit Enforcement**
   - Check entries.length >= LIMITS.maxIndexEntries (100) at multiple points
   - Early exit prevents unnecessary work

3. **Summary Extraction**
   - Split content by newline, find first non-empty line
   - Trim and truncate to LIMITS.maxSummaryLength (100)

4. **Error Handling Strategy**
   - Try-catch blocks around all filesystem operations
   - Silent skip for inaccessible files/directories
   - No throwing - always return valid results

### Constants Used
- LIMITS.maxIndexEntries: 100
- LIMITS.maxScanDepth: 3
- LIMITS.maxSummaryLength: 100

## Task 5: Scaffold System (TDD)

**Completed**: 2026-02-26

### Implementation
WV|- Created `src/lib/scaffold.ts` with `scaffoldIfNeeded(projectDir: string): boolean`
NX|- Creates `.opencode/context/` directory structure with prompts subdirectory
XX|- Generates default `config.jsonc`, `turn-start.md`, `turn-end.md`
RT|
### Test Cases (5 tests)
SB|1. Creates .opencode/context/ directory structure when not exists
XZ|2. Creates config.jsonc with valid content
HK|3. Creates turn-start.md and turn-end.md
XJ|4. Returns true on first scaffold, false when already exists (idempotent)
YT|5. Does NOT overwrite existing files

### Evidence
QZ|- `.sisyphus/evidence/task-5-scaffold.txt`
NS|- `.sisyphus/evidence/task-5-idempotent.txt`

### Key Patterns

1. **Idempotency via Directory Check**
   - Check `existsSync(contextDir)` - if exists, return false immediately
   - No file-by-file checks needed
   - Simple and reliable

2. **Graceful Error Handling**
   - Try-catch around all filesystem operations
   - Throw with [ERROR] prefix for consistency
   - No silent failures - caller knows if scaffold failed

3. **Default Content Templates**
   - DEFAULT_CONFIG: JSONC with prompts and knowledge configuration
   - DEFAULT_TURN_START: Korean instructions for knowledge context
   - DEFAULT_TURN_END: Korean checklist for quality assurance

4. **Constants Integration**
   - Uses DEFAULTS.turnStartFile and DEFAULTS.turnEndFile from constants
   - Maintains single source of truth for file names

