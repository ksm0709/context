# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0](https://github.com/ksm0709/context/compare/v0.2.0...v0.3.0) (2026-04-03)


### Features

* inject knowledge context into CLI-specific global instruction files ([4c37dbc](https://github.com/ksm0709/context/commit/4c37dbc6f1292a8323914941211f7bed76caaaf4))

## [0.2.0](https://github.com/ksm0709/context/compare/v0.1.0...v0.2.0) (2026-04-03)


### Features

* resolve .context and AGENTS.md/CLAUDE.md to git repo root with home fallback ([3cb14f3](https://github.com/ksm0709/context/commit/3cb14f32d49497e42f279e07e5ff2f82edca5902))


### Bug Fixes

* **ci:** switch publish to OIDC trusted publisher, remove NPM_TOKEN ([0a32fc3](https://github.com/ksm0709/context/commit/0a32fc3776a5a430cea02e0cff979ec5d0990fb8))

## [0.1.0](https://github.com/ksm0709/context/compare/v0.0.29...v0.1.0) (2026-04-03)


### Features

* improve note discovery so agents can navigate knowledge by metadata ([5c169e4](https://github.com/ksm0709/context/commit/5c169e464eee5bc1845d6cab6a6473e49762370d))


### Bug Fixes

* **ci:** add NPM_TOKEN auth to publish workflow ([36d45a2](https://github.com/ksm0709/context/commit/36d45a20c3c831a78d8acd201b6d3828484cf64b))
* **mcp:** fix omc/omx context-mcp registration and Codex compatibility ([f68f4f3](https://github.com/ksm0709/context/commit/f68f4f3051c4d967e64c059f319ca7a500575bab))

## [0.0.37] - 2026-04-03

### Features

- deduplicate Claude hooks by script basename so path changes during upgrades don't create duplicate entries

### Fixes

- remove accidental self-dependency (`@ksm0709/context`) from production dependencies

### Docs

- update AGENTS.md with metadata-first knowledge discovery workflow
- add template mode guidance to note-guide

## [0.0.36] - 2026-03-27

### Features

- make `create_knowledge_note` template mode treat `.context/templates/*.md` as the note spec and validate completed markdown instead of appending a summary below the template

### Fixes

- reject `tags` and `linked_notes` in template mode to avoid duplicating metadata outside the template document
- remove the accidental self-dependency before the next npm publish

### Tests

- add template-mode success, placeholder rejection, missing-heading rejection, and non-template regression coverage for `create_knowledge_note`

### Docs

- clarify in scaffold guidance that template mode requires fully completed markdown content

## [0.0.35] - 2026-03-27

### Features

- switch `context-mcp` knowledge search to metadata-first ranked discovery for long natural-language queries
- append linked-note metadata to `read_knowledge` so agents can continue traversing related notes

### Tests

- add focused search/read workflow coverage for metadata extraction, ranking, and related-note tails

### Docs

- document the metadata-first `search_knowledge` → `read_knowledge` workflow for agents

## [0.0.34] - 2026-03-26

### Fixes

- remove the package's accidental self-dependency so `bun add @ksm0709/context` can install cleanly during `context update plugin`

## [0.0.33] - 2026-03-26

### Fixes

- normalize legacy `context_mcp` Claude entries to `context-mcp` during OMC install
- add explicit `context update omx` routing so OMX-only updates avoid Claude reinstall side effects
- recognize both `context-mcp` and `context_mcp` when detecting existing OMC registrations

### Docs

- update OMX setup guidance for the normalized MCP server name

## [0.0.12] - 2026-03-08

### Features

- **agent**: inject explore agent delegation prompt into turnStart

### Docs

- update RELEASE.md and CHANGELOG.md for version tracking

## [0.0.11] - 2026-03-08

### Fixes

- **cli**: support `--version`, help flag interception, and update `--help`

## [0.0.10] - 2026-03-08

### Features

- **cli**: implement context update subcommands (`all`, `prompt`, `plugin`)
- **agent**: delegate quality check and knowledge note writing to subagents in turn-end prompt
- **cli**: replace `/context-update` command with CLI tool
- **scaffold**: auto-update on version change + fix context-update command

### Fixes

- restore context-update behavior and update debugging docs
- resolve plugin loading name issue by adding main and import exports

### Refactoring

- derive `PLUGIN_VERSION` from `package.json`, remove `version.ts`

### Improvements

- **style**: fix prettier formatting on `eslint.config.js`
- **agent**: Update `AGENTS.md`

### Docs

- clarify `package.json` import is bundled at build time, not runtime
- remove `version.ts` decision note + update `architecture.md`
- completely rewrite runbook and update gotcha docs emphasizing `rm -rf ~/.config/opencode/node_modules`
- cleanup duplicate related links in gotcha cache version mismatch
- update runbook log output to match new plugin loading mechanism
- add insight on OpenCode plugin loading debugging
- add gotcha for OpenCode plugin cache version mismatch
- add `CHANGELOG.md` with full version history (0.0.1–0.0.6)

## [0.0.7] - 2025-03-01

### Fixes

- **command.execute.before 타입 에러 수정**: `Part` 객체에 필수 필드 `id`, `sessionID`, `messageID` 추가

## [0.0.6] - 2025-03-01

### Features

- **Domain-based INDEX.md knowledge structure**: 도메인 폴더 + `INDEX.md` 기반 지식 관리. `mode: "auto"` 감지로 하위호환 유지. 개별 파일 나열 대신 INDEX.md 내용만 주입하여 토큰 절약
- `scanDomains()`, `detectKnowledgeMode()`, `formatDomainIndex()`, `buildKnowledgeIndexV2()` 함수 추가
- Config에 `mode`, `indexFilename`, `maxDomainDepth` optional 필드 추가
- INDEX.md scaffold 템플릿 추가 (9번째 템플릿)

### Improvements

- turn-end 퀄리티 체크리스트 개선: 타입 에러 확인 → formatter 실행 + 변경 범위 확인으로 교체
- turn-start에 TDD/DDD 개발 원칙 가이드 추가
- turn-start/turn-end에 테스트 커버리지 80% 목표 추가
- turn-start에 도메인 폴더 INDEX.md 네비게이션 안내 추가

### Docs

- ADR-002: 도메인 폴더 + INDEX.md 기반 지식 구조 결정 문서
- architecture.md 업데이트: 이중 모드(flat/domain) 스캐닝, 새 상수, scaffold 12개 파일 반영

## [0.0.5] - 2025-02-28

### Fixes

- knowledge index를 system prompt에서 user message로 이동 — turn-start와 같은 text part에 결합하여 공간적 참조 유지

### Docs

- Bug note: knowledge index 공간적 참조 깨짐 문제 기록

## [0.0.4] - 2025-02-27

### Features

- Zettelkasten 가이드 + 8개 노트 템플릿을 turn-start/turn-end 훅 콘텐츠에 추가
- scaffold가 `.opencode/context/templates/` 디렉토리에 8개 템플릿 자동 생성

### Docs

- ADR-001: 제텔카스텐 훅 콘텐츠 + 8개 개별 노트 템플릿 결정 문서

## [0.0.3] - 2025-02-26

### Features

- Synthetic 메시지에서 실제 user message 기반 프롬프트 주입으로 전환
- `/context-update` 커맨드 추가 — scaffold 파일을 최신 플러그인 버전으로 업데이트
- Zettelkasten을 기본 지식 관리 방식으로 채택

### Refactoring

- turn-end 주입을 system prompt에서 별도 user message로 이동

## [0.0.2] - 2025-02-25

### Features

- `knowledge.dir` config 옵션 추가, scaffold 프롬프트 개선
- 파일 기반 프롬프트 주입 플러그인 초기 구현

### Docs

- Plugin architecture 문서 작성
- AGENTS.md에 플러그인 개발 가이드라인 추가

## [0.0.1] - 2025-02-25

- Initial release from bun-module template
