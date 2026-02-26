# Plugin Architecture

`@ksm0709/context`는 OpenCode 플러그인으로, AI 코딩 에이전트의 시스템 프롬프트에 프로젝트 지식을 자동 주입합니다.

## Injection Flow

매 턴마다 두 개의 훅이 호출되어 컨텍스트를 주입합니다:

**`experimental.chat.system.transform`** — 시스템 프롬프트에 2개 블록 주입:

```
[기존 system prompt]
  ↓
[turn-start.md]      ← 작업 전 지침, 지식 활용 가이드
[Available Knowledge] ← knowledge index (자동 생성)
```

**`experimental.chat.messages.transform`** — 대화 히스토리 끝에 synthetic user message 추가:

```
[기존 messages]
  ↓
[synthetic UserMessage] ← turn-end.md 내용, <system-reminder> 태그로 감싸짐
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

`knowledge.dir`과 `knowledge.sources`를 결합하여 스캔합니다:

1. `dir` (디렉토리) → 재귀 스캔하여 `.md` 파일 수집
2. `sources` (파일/디렉토리) → 각각 파일이면 직접 추가, 디렉토리면 재귀 스캔

**스캔 규칙:**

- `.md` 파일만 수집
- 최대 depth: 3
- 최대 엔트리: 100개
- summary: 각 파일의 첫 번째 비어있지 않은 줄 (최대 100자)

**출력 포맷:**

```markdown
## Available Knowledge

- AGENTS.md — # AGENTS.md
- docs/architecture.md — # Plugin Architecture
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
└── prompts/
    ├── turn-start.md    ← 지식 컨텍스트 안내
    └── turn-end.md      ← 마무리 체크리스트
```

- **멱등성**: `.opencode/context/` 디렉토리가 이미 존재하면 아무것도 하지 않음
- 사용자가 수정한 파일을 덮어쓸 위험 없음

## Safety Limits (`constants.ts`)

| 제한                    | 값    | 목적                           |
| ----------------------- | ----- | ------------------------------ |
| `maxPromptFileSize`     | 64KB  | 프롬프트 파일 크기 제한        |
| `maxIndexEntries`       | 100개 | knowledge index 엔트리 수 제한 |
| `maxTotalInjectionSize` | 128KB | 전체 주입 크기 제한            |
| `maxScanDepth`          | 3     | 디렉토리 재귀 탐색 깊이        |
| `maxSummaryLength`      | 100자 | 엔트리 요약 길이               |

## Plugin Entry Point (`index.ts`)

```typescript
const plugin: Plugin = async ({ directory, client }) => {
  // 1. Scaffold on first run
  // 2. Load config once at plugin init
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      // 3. Read turn-start prompt (hot-reload)
      // 4. Build knowledge index (dir + sources)
      // 5. Inject turn-start + knowledge index into output.system
    },
    'experimental.chat.messages.transform': async (_input, output) => {
      // 6. Read turn-end prompt (hot-reload)
      // 7. Inject as synthetic UserMessage wrapped in <system-reminder> tags
    },
  };
};
```

**설계 결정:**

- config는 플러그인 초기화 시 1회만 로드 (변경 시 재시작 필요)
- prompt 파일은 매 턴마다 읽음 (실시간 수정 반영)
- knowledge index도 매 턴마다 빌드 (파일 추가/삭제 즉시 반영)
- turn-end는 system prompt 대신 synthetic user message로 인젝트 — 에이전트 턴 종료 후 리마인더로 동작하도록 설계
- synthetic user message는 `<system-reminder>` 태그로 감싸 모델이 시스템 지시로 인식하도록 함
