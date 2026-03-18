Self-referential dependency '@ksm0709/context' in package.json caused npm install loops. Removed it.

AGENTS.md marker injection is safest with `indexOf` boundary parsing instead of regex: append a single marker block when missing, replace only the slice between `<!-- context:start -->` and `<!-- context:end -->` when present, and persist via `.tmp` + `renameSync` for atomic writes.

For context directory migration, a tiny `existsSync(join(projectDir, ...))` resolver plus tmpdir-based real filesystem tests covers legacy-vs-default precedence without fs mocking.

## ADR-003 및 Decision-OMX 작성 완료

- ADR-003: OMX 호환성 및 turn-end 주입 전략을 ADR 템플릿에 맞춰 작성함.
- Decision-OMX: OMX 환경에서의 turn-end 주입 조사를 Decision 템플릿에 맞춰 작성함.
- 템플릿 사용 시 [[wikilink]]를 통해 관련 노트 간의 연결성을 확보함.

OMX 엔트리포인트는 `session-start`에서만 동작하도록 early return 하고, 프로젝트 루트는 `event.context.projectDir ?? event.context.directory ?? process.cwd()` 순서로 해석하면 테스트 가능한 fallback을 유지하면서 환경별 event shape 차이를 흡수할 수 있다.

OMX에서는 OpenCode의 메시지 변환 대신 `turn-start + formatKnowledgeIndex/formatDomainIndex()` 결과를 하나의 문자열로 결합해 `injectIntoAgentsMd()`에 넘기면, 기존 `AGENTS.md` 본문은 유지하면서 marker block만 안정적으로 갱신할 수 있다.

Scaffold 리팩터링에서는 `DEFAULTS`의 기본 경로만 `.context/`로 옮기고, 실제 파일 읽기/쓰기 위치는 `resolveContextDir(projectDir)`로 통일해야 신규 기본값과 legacy `.opencode/context` fallback을 함께 유지할 수 있다.

`scaffold.test.ts`는 기본 생성 경로 assertion을 `.context/`로 바꾸되, legacy 디렉토리가 이미 있을 때 `scaffoldIfNeeded()`, `updateScaffold()`, `autoUpdateTemplates()`가 새 디렉토리를 만들지 않고 기존 `.opencode/context`를 계속 쓰는 케이스를 함께 고정하면 하위호환 회귀를 막을 수 있다.

`resolveContextDir()` 검증은 `tmpdir()` 기반 고유 프로젝트 디렉토리를 만들고 `afterEach`에서 `rmSync(..., { recursive: true, force: true })`로 정리하면 `.context` 우선순위와 legacy fallback을 fs mocking 없이 안정적으로 커버할 수 있다.

## ADR-003 및 Decision-OMX 작성 완료

- ADR-003: OMX 호환성 및 turn-end 주입 전략을 ADR 템플릿에 맞춰 작성함.
- Decision-OMX: OMX 환경에서의 turn-end 주입 조사를 Decision 템플릿에 맞춰 작성함.
- 템플릿 사용 시 [[wikilink]]를 통해 관련 노트 간의 연결성을 확보함.

## ADR-003 및 Decision-OMX 작성 완료

- ADR-003: OMX 호환성 및 turn-end 주입 전략을 ADR 템플릿에 맞춰 작성함.
- Decision-OMX: OMX 환경에서의 turn-end 주입 조사를 Decision 템플릿에 맞춰 작성함.
- 템플릿 사용 시 [[wikilink]]를 통해 관련 노트 간의 연결성을 확보함.

OpenCode 엔트리포인트(`src/index.ts`)에서 prompt 경로를 해석할 때, `resolvePromptPath` 헬퍼로 3가지 케이스를 분기하면 legacy `.opencode/context/`와 신규 `.context/` 모두 안정적으로 지원할 수 있다: (1) `isAbsolute` → 그대로 사용, (2) `.context/` 또는 `.opencode/` prefix → `join(directory, path)`, (3) 그 외 상대 경로 → `join(directory, contextDir, path)`. 이때 `resolveContextDir`는 scaffold 이후에 호출해야 새로 생성된 디렉토리를 올바르게 감지한다.
