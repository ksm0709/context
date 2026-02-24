# OpenCode Plugin Patterns

실제 오픈소스 플러그인(DCP, oh-my-opencode, wakatime, helicone)에서 추출한 검증된 패턴.

---

## 아키텍처 선택 가이드

| 규모                 | 구조                                            | 레퍼런스           |
| -------------------- | ----------------------------------------------- | ------------------ |
| 단순 (훅 1~3개)      | Flat — `src/index.ts` + 유틸 파일들             | wakatime, helicone |
| 중간 (기능 모듈화)   | Lib — `index.ts` + `lib/` 서브모듈              | DCP                |
| 대형 (복잡한 의존성) | Full separation — `create-hooks/tools/managers` | oh-my-opencode     |

### Flat 구조

```
src/
├── index.ts      ← 플러그인 진입점 + 훅 정의
├── logger.ts
├── state.ts
└── core.ts       ← 핵심 비즈니스 로직
```

### Lib 구조 (DCP 패턴)

```
index.ts                ← 얇게: 초기화 + hooks 객체 조립만
lib/
├── config.ts           ← 설정 로드/병합
├── logger.ts
├── state.ts            ← createSessionState() 팩토리
└── hooks.ts            ← 각 훅 핸들러 팩토리 함수
```

### Full Separation (oh-my-opencode 패턴)

```
src/
├── index.ts              ← 조립만 (new 호출 없음, 팩토리만)
├── create-hooks.ts
├── create-managers.ts
├── create-tools.ts
├── plugin-interface.ts   ← 최종 Hooks 객체 조립
├── plugin-config.ts
├── config.ts             ← 타입 정의만
└── plugin/               ← 각 훅 핸들러 1파일
    ├── event.ts
    ├── tool-execute-before.ts
    └── chat-params.ts
```

---

## 상태 관리

### 팩토리 함수 패턴 (권장 — 테스트 용이)

```typescript
// lib/state.ts
export function createSessionState() {
  return {
    sessionMap: new Map<string, SessionData>(),
    variant: undefined as string | undefined,
    pruneStats: { saved: 0, total: 0 },
  };
}
// 타입: ReturnType<typeof createSessionState>
```

### 모듈 레벨 변수 (단순한 경우)

```typescript
// 툴 이벤트 중복 방지 (callID 기반)
const processedIds = new Set<string>();

// 메모리 누수 방지
function addProcessed(id: string) {
  processedIds.add(id);
  if (processedIds.size > 1000) {
    const arr = [...processedIds];
    arr.slice(0, 500).forEach((x) => processedIds.delete(x));
  }
}

// 파일별 누적 변경사항
const fileChanges = new Map<string, { additions: number; deletions: number }>();
```

---

## Config 시스템 (멀티 스코프 병합)

DCP의 검증된 패턴:

```typescript
// lib/config.ts
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { parse as parseJsonc } from 'jsonc-parser';

const DEFAULTS: Config = { enabled: true, debug: false };

export function loadConfig(ctx: PluginInput): Config {
  const globalPath = `${os.homedir()}/.config/opencode/myplugin.jsonc`;
  const projectPath = `${ctx.directory}/.opencode/myplugin.jsonc`;

  const global = tryLoad(globalPath) ?? {};
  const project = tryLoad(projectPath) ?? {};

  // 우선순위: Defaults < Global < Project
  return deepMerge(DEFAULTS, global, project);
}

function tryLoad(path: string): Partial<Config> | null {
  try {
    return parseJsonc(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}
```

---

## 조건부 툴 등록

```typescript
return {
  tool: {
    // config에 따라 동적으로 등록/제외
    ...(config.tools.prune.permission !== 'deny' && {
      prune: createPruneTool({ client, state, logger, config, workingDirectory }),
    }),
    ...(config.enabled && {
      search: searchTool,
    }),
  },
};
```

---

## 슬래시 커맨드 + 핸들러 패턴

DCP의 `/dcp` 커맨드 구현 방식:

```typescript
// 1. config 훅에서 커맨드 등록
config: async (cfg) => {
  cfg.command ??= {}
  cfg.command["mycmd"] = { template: "", description: "My command" }
},

// 2. command.execute.before 훅에서 처리
"command.execute.before": async (input, output) => {
  if (input.command !== "mycmd") return
  const args = input.arguments.trim()

  if (args === "status") {
    output.parts = [{ type: "text", text: "## Status\n..." }]
    return
  }
  if (args === "reset") {
    state.reset()
    output.parts = [{ type: "text", text: "Reset done." }]
    return
  }
  // 기본: 도움말
  output.parts = [{ type: "text", text: "Usage: /mycmd [status|reset]" }]
}
```

---

## 시스템 프롬프트 주입

```typescript
"experimental.chat.system.transform": async (_input, output) => {
  // output.system 배열에 append
  output.system.push(`## Plugin Context\n- Feature enabled: ${config.feature}`)
}
```

**주의**: subagent 세션 구분이 필요하면 `input.sessionID`로 필터링.

---

## 대화 히스토리 수정 (DCP 핵심 기법)

```typescript
"experimental.chat.messages.transform": async (_input, output) => {
  // output.messages 배열을 직접 수정
  // 각 message: { info: Message, parts: Part[] }
  // Part 중 tool type: { type: "tool", callID, tool, state }

  output.messages = output.messages.map(msg => ({
    ...msg,
    parts: msg.parts.map(part => {
      if (part.type !== "tool") return part
      if (shouldPrune(part)) {
        return { ...part, state: { ...part.state, output: "[pruned]" } }
      }
      return part
    }),
  }))
}
```

---

## 세션 압축 커스터마이징

```typescript
// Context 추가 (기본 프롬프트 유지 + 추가)
"experimental.session.compacting": async (input, output) => {
  output.context.push(`## Plugin State\n${JSON.stringify(state.getSnapshot())}`)
},

// 프롬프트 전체 교체
"experimental.session.compacting": async (_input, output) => {
  output.prompt = `Summarize: 1. Current task 2. Modified files 3. Next steps`
}
```

---

## Bun Shell 사용

```typescript
// ctx.$ 사용 (import 불필요)
const result = await $`git log --oneline -5`.text()
const files = await $`find . -name "*.ts"`.lines()

// 에러 핸들링
const out = await $`some-command`.nothrow()
if (out.exitCode !== 0) { ... }
```

---

## Build 설정 비교

### tsc 기반 (단순, DCP 스타일)

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": true,
    "strict": true
  }
}
```

```json
// package.json scripts
{ "build": "tsc", "prepublishOnly": "npm run build" }
```

### bun build 기반 (빠름, oh-my-opencode 스타일)

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": true // bun이 JS 생성, tsc는 .d.ts만
  }
}
```

```json
// package.json scripts
{
  "build": "bun build src/index.ts --outdir dist --target bun --format esm && tsc --emitDeclarationOnly",
  "prepublishOnly": "bun run clean && bun run build"
}
```

**이 프로젝트 (intent-tools)**: `bun build` 기반 (AGENTS.md 기준 `bun build ./src/index.ts --outdir dist --target bun`)

---

## npm 배포 체크리스트

```
□ peerDependencies에 @opencode-ai/plugin >=1.0.0
□ dependencies에 런타임 의존성만 (zod, @opencode-ai/sdk 등)
□ devDependencies에 @opencode-ai/plugin 정확한 버전
□ files 배열에 "dist/", "README.md", "LICENSE"
□ keywords에 "opencode", "opencode-plugin"
□ exports 필드에 types + import 경로
□ index.ts에서 타입 외 named export 없음
□ export default Plugin 있음
```

---

## 실제 플러그인 레퍼런스

| 플러그인       | 핵심 패턴                                                                | 링크                                                                       |
| -------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| DCP            | `experimental.chat.messages.transform`, config system, conditional tools | [GitHub](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) |
| oh-my-opencode | Full separation 아키텍처, bun build, MCP 통합                            | [GitHub](https://github.com/code-yeongyu/oh-my-opencode)                   |
| wakatime       | `event` + `message.part.updated` 추적, 파일별 diff 추출                  | [GitHub](https://github.com/angristan/opencode-wakatime)                   |
| helicone       | `auth.loader` 커스텀 fetch wrapper, global state                         | [GitHub](https://github.com/H2Shami/opencode-helicone-session)             |
