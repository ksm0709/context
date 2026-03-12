# Plugin Architecture

`@ksm0709/context`는 OpenCode 플러그인으로, AI 코딩 에이전트의 시스템 프롬프트에 프로젝트 지식을 자동 주입합니다.

## Injection Flow

매 턴마다 두 개의 훅이 호출되어 컨텍스트를 주입합니다:

매 턴마다 하나의 훅이 호출되어 컨텍스트를 주입합니다:

**`experimental.chat.messages.transform`** — 대화 히스토리에 2가지 주입:

1. 마지막 유저 메시지 parts에 **turn-start.md + Available Knowledge** 결합하여 append
2. 대화 끝에 별도 유저 메시지로 turn-end.md 주입 (`<system-reminder>` 태그)

두 주입 모두 synthetic 플래그 없음 → AI가 실제 지시사항으로 처리

```
[기존 messages]
  ↓
[마지막 UserMessage parts에 turn-start + Available Knowledge 결합하여 append]
[별도 UserMessage로 turn-end 주입] ← <system-reminder> 태그
```

비어있는 블록은 건너뜁니다. messages 배열이 비어있거나 UserMessage가 없으면 turn-end 인젝션을 건너뜁니다.

## 핵심 모듈

### Config Loader (`lib/config.ts`)

- 경로: `.opencode/context/config.jsonc`
- JSONC 포맷 (주석 허용) — `jsonc-parser` 사용
- partial config → `mergeWithDefaults()`로 기본값과 병합
- 파일 없거나 파싱 실패 시 기본값 반환 (graceful fallback)

```jsonc
{
  "prompts": {
    "turnStart": ".opencode/context/prompts/turn-start.md",
    "turnEnd": ".opencode/context/prompts/turn-end.md",
  },
  "knowledge": {
    "dir": "docs", // 지식 스캔 디렉토리 (기본: docs/)
    "sources": ["AGENTS.md"], // 추가 개별 파일/폴더
  },
}
```

### Knowledge Index Builder (`lib/knowledge-index.ts`)

`knowledge.dir`과 `knowledge.sources`를 결합하여 스캔합니다. **이중 모드** 지원:

#### Flat 모드 (기존 동작)

1. `dir` (디렉토리) → 재귀 스캔하여 `.md` 파일 수집
2. `sources` (파일/디렉토리) → 각각 파일이면 직접 추가, 디렉토리면 재귀 스캔

#### Domain 모드 (INDEX.md 기반) — [[docs/adr-002-domain-index-knowledge-structure.md]]

1. `dir` 하위 폴더에서 `INDEX.md` 파일을 탐색 (maxDomainDepth: 2)
2. INDEX.md가 있는 폴더 = 도메인. INDEX.md 내용을 인라인 주입
3. 도메인에 속하지 않는 root-level `.md` + `sources` = individual files

**모드 감지 (`mode: "auto"` 기본값):**

- 하위 폴더에 INDEX.md가 1개 이상 있으면 → domain 모드
- 없으면 → flat 모드 (100% 하위호환)

**Flat 출력:**

```markdown
## Available Knowledge

- AGENTS.md — # AGENTS.md
- docs/architecture.md — # Plugin Architecture
```

**Domain 출력:**

```markdown
## Available Knowledge

### Domains

#### docs/architecture/ (3 notes)

# Architecture Domain

...INDEX.md 내용...

### Individual Files

- AGENTS.md — # AGENTS.md
```

### Prompt Reader (`lib/prompt-reader.ts`)

- 매 훅 호출마다 파일을 새로 읽음 → **hot-reload** 지원
- 파일 없으면 빈 문자열 반환 (에러 없음)
- 최대 파일 크기: 64KB (초과 시 truncate)

### Scaffold System (`lib/scaffold.ts`)

플러그인 최초 실행 시 `.opencode/context/` 구조를 자동 생성합니다:

```
.opencode/context/
├── config.jsonc         ← 기본 설정
├── prompts/
│   ├── turn-start.md    ← 제텔카스텐 가이드 + 지식 읽기 안내
│   └── turn-end.md      ← 마무리 체크리스트 + 9가지 템플릿 링크
└── templates/           ← 노트 작성 템플릿 (9개)
    ├── adr.md           ← Architecture Decision Record
    ├── pattern.md       ← 코드 패턴/컨벤션
    ├── bug.md           ← 버그 패턴 + 해결
    ├── gotcha.md        ← 외부 라이브러리/API 함정
    ├── decision.md      ← 경량 결정 로그
    ├── context.md       ← 프로젝트/모듈 맥락
    ├── runbook.md       ← 절차서
    ├── insight.md       ← 발견/학습
    └── index.md         ← 도메인 INDEX.md 템플릿
```

- **멱등성**: `.opencode/context/` 디렉토리가 이미 존재하면 아무것도 하지 않음
- 사용자가 수정한 파일을 덮어쓸 위험 없음
- `updateScaffold()`: 12개 파일 관리 (config + 2 prompts + 9 templates) — 내용이 다를 때만 업데이트
- `updatePrompts()`: prompts 2개 파일만 업데이트 (config/templates 보존) — 사용자 명시적 요청용
- `autoUpdateTemplates()`: 플러그인 버전 변경 시 templates만 자동 갱신 (config/prompts 보존)
- 기존 설치의 `prompts/*.md`는 자동 재작성되지 않음 — 새 기본 프롬프트를 적용하려면 사용자가 `context update prompt`를 직접 실행해야 함
- **버전 추적**: `package.json`의 `version`을 빌드 타임에 직접 읽음 (`import pkg from '../../package.json'`). `.opencode/context/.version` 파일과 비교하여 불일치 시 자동 업데이트 트리거 → [[docs/decision-remove-version-ts.md]]
- **CLI 업데이트 커맨드**: `context update [all|prompt|plugin]` — 아래 CLI System 섹션 참고
- 관련 결정: [[docs/adr-001-zettelkasten-hook-templates.md]]
- 관련 결정: [[docs/decision-scaffold-auto-update-scope.md]] — templates만 자동 갱신
- 관련 함정: [[docs/gotcha-opencode-run-session-not-found.md]] — `opencode run`으로 scaffold 검증 불가
- 관련 함정: [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] — OpenCode가 최신 버전을 캐시하지 않음
- 관련 결정: [[docs/adr-002-domain-index-knowledge-structure.md]] — 도메인 폴더 + INDEX.md 기반 구조

### CLI System (`cli/`)

플러그인과 독립적으로 실행되는 CLI 도구. 순수 파일시스템 작업만 수행하며, OpenCode 컨텍스트가 필요 없습니다.

```
src/cli/
├── index.ts              ← 진입점 (process.argv 파싱, 커맨드 라우팅)
├── cli.test.ts           ← CLI 통합 테스트
└── commands/
    ├── update.ts         ← update 서브커맨드 (all/prompt/plugin)
    └── update.test.ts    ← detectPackageManager, isGloballyInstalled, runUpdatePlugin 단위 테스트
```

**사용법:**

| 커맨드                                         | 동작                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `context update` / `context update all [path]` | 12개 파일 전부 강제 업데이트 (config + prompts + templates) |
| `context update prompt [path]`                 | prompts 2개 파일만 업데이트 (config/templates 보존)         |
| `context update plugin [version]`              | @ksm0709/context 패키지 자체를 업데이트 (기본: latest)      |

- **하위 호환**: `context update /path`는 `context update all /path`로 해석
- **패키지 매니저 자동 감지**: lockfile 기반 (bun.lock → bun, pnpm-lock.yaml → pnpm, yarn.lock → yarn, package-lock.json → npm, 기본: bun)
- **글로벌 우선 업데이트**: `update plugin` 실행 시 `~/.bun/bin/context` 글로벌 바이너리가 존재하면 `bun install -g`로 글로벌 먼저 업데이트한 뒤 로컬 업데이트 수행. 글로벌 바이너리가 없으면 로컬만 업데이트 → [[docs/gotcha-bun-global-cli-version-mismatch.md]]
- 관련 결정: [[docs/decision-cli-tool-over-opencode-command.md]]

## Safety Limits (`constants.ts`)

| 제한                    | 값    | 목적                           |
| ----------------------- | ----- | ------------------------------ |
| `maxPromptFileSize`     | 64KB  | 프롬프트 파일 크기 제한        |
| `maxIndexEntries`       | 100개 | knowledge index 엔트리 수 제한 |
| `maxTotalInjectionSize` | 128KB | 전체 주입 크기 제한            |
| `maxScanDepth`          | 3     | 디렉토리 재귀 탐색 깊이        |
| `maxSummaryLength`      | 100자 | 엔트리 요약 길이               |
| `maxIndexFileSize`      | 32KB  | INDEX.md 파일 크기 제한        |
| `maxDomainDepth`        | 2     | INDEX.md 탐색 깊이             |

## Plugin Entry Point (`index.ts`)

```typescript
const plugin: Plugin = async ({ directory, client }) => {
  // 1. Scaffold on first run
  // 2. Load config once at plugin init
  return {
    'experimental.chat.messages.transform': async (_input, output) => {
      // 3. Read turn-start + build knowledge index → combine with \n\n → append to last user message
      // 4. Inject turn-end as separate user message (hot-reload)
    },
  };
};
```

**설계 결정:**

- config는 플러그인 초기화 시 1회만 로드 (변경 시 재시작 필요)
- prompt 파일은 매 턴마다 읽음 (실시간 수정 반영)
- knowledge index도 매 턴마다 빌드 (파일 추가/삭제 즉시 반영)
- turn-start와 knowledge index는 **같은 text part에 결합** — "아래 Available Knowledge" 공간적 참조 유지
- turn-end는 별도 유저 메시지로 주입 (`<system-reminder>` 태그) — synthetic 플래그 없이 실제 액션 유발
- synthetic 플래그 미사용: AI가 soft context가 아닌 실행 가능한 지시사항으로 처리하도록 설계 → [[docs/synthetic-message-injection.md]] 참고
- 관련 버그: [[docs/bug-knowledge-index-spatial-mismatch.md]]

## 관련 노트

- [[synthetic-message-injection.md]] — Synthetic 메시지 주입의 한계와 대안
