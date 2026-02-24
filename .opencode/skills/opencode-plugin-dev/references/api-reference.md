# @opencode-ai/plugin API Reference

Source: https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts  
Version: 1.2.10

---

## PluginInput

플러그인 함수가 받는 컨텍스트 객체.

```typescript
type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>; // OpenCode SDK 클라이언트
  project: Project; // 현재 프로젝트 정보
  directory: string; // 현재 작업 디렉토리
  worktree: string; // git worktree 경로
  serverUrl: URL; // OpenCode 서버 URL
  $: BunShell; // Bun shell API ($`command`)
};
```

## Plugin Type

```typescript
type Plugin = (input: PluginInput) => Promise<Hooks>;
```

---

## Hooks Interface (전체)

```typescript
interface Hooks {
  // 커스텀 툴 등록
  tool?: { [key: string]: ToolDefinition };

  // OpenCode config 변경 (커맨드, 권한, primary_tools 등)
  config?: (input: Config) => Promise<void>;

  // 인증 프로바이더 등록
  auth?: AuthHook;

  // 모든 이벤트 수신 (session.*, message.part.updated 등)
  event?: (input: { event: Event }) => Promise<void>;

  // 새 유저 메시지 수신
  'chat.message'?: (
    input: {
      sessionID: string;
      agent?: string;
      model?: { providerID: string; modelID: string };
      messageID?: string;
      variant?: string;
    },
    output: { message: UserMessage; parts: Part[] }
  ) => Promise<void>;

  // LLM 요청 파라미터 수정
  'chat.params'?: (
    input: {
      sessionID: string;
      agent: string;
      model: Model;
      provider: ProviderContext;
      message: UserMessage;
    },
    output: { temperature: number; topP: number; topK: number; options: Record<string, any> }
  ) => Promise<void>;

  // LLM 요청 헤더 수정 (예: Helicone session 헤더)
  'chat.headers'?: (
    input: {
      sessionID: string;
      agent: string;
      model: Model;
      provider: ProviderContext;
      message: UserMessage;
    },
    output: { headers: Record<string, string> }
  ) => Promise<void>;

  // 권한 요청 자동 처리
  'permission.ask'?: (
    input: Permission,
    output: { status: 'ask' | 'deny' | 'allow' }
  ) => Promise<void>;

  // 슬래시 커맨드 실행 전
  'command.execute.before'?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] }
  ) => Promise<void>;

  // 툴 실행 전 — args 수정 or throw로 차단 가능
  'tool.execute.before'?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any }
  ) => Promise<void>;

  // 환경변수 주입 (셸 + AI 툴 모두 적용)
  'shell.env'?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> }
  ) => Promise<void>;

  // 툴 실행 후 — title/output/metadata 수정 가능
  'tool.execute.after'?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any }
  ) => Promise<void>;

  // 툴 definition(description, parameters)을 LLM 전달 전 수정
  'tool.definition'?: (
    input: { toolID: string },
    output: { description: string; parameters: any }
  ) => Promise<void>;

  // [실험적] 대화 히스토리 전체 변환
  'experimental.chat.messages.transform'?: (
    input: {},
    output: { messages: { info: Message; parts: Part[] }[] }
  ) => Promise<void>;

  // [실험적] 시스템 프롬프트 수정/추가
  'experimental.chat.system.transform'?: (
    input: { sessionID?: string; model: Model },
    output: { system: string[] }
  ) => Promise<void>;

  // [실험적] 세션 압축 프롬프트 커스텀
  // output.context 배열에 추가 → 기본 프롬프트 뒤에 append
  // output.prompt 설정 → 기본 프롬프트 전체 교체 (context 무시됨)
  'experimental.session.compacting'?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string }
  ) => Promise<void>;

  // [실험적] 텍스트 완성 후
  'experimental.text.complete'?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string }
  ) => Promise<void>;
}
```

---

## tool() Helper

```typescript
import { tool } from '@opencode-ai/plugin';

function tool<Args extends z.ZodRawShape>(input: {
  description: string;
  args: Args; // Zod schema (tool.schema === zod)
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>; // 반환값이 LLM에 툴 결과로 전달됨
}): ToolDefinition;

tool.schema = z; // zod 직접 접근
```

### ToolContext

```typescript
type ToolContext = {
  sessionID: string;
  messageID: string;
  agent: string;
  directory: string; // process.cwd() 대신 이것 사용
  worktree: string;
  abort: AbortSignal;
  metadata(input: { title?: string; metadata?: Record<string, any> }): void;
  ask(input: {
    permission: string;
    patterns: string[];
    always: string[];
    metadata: Record<string, any>;
  }): Promise<void>;
};
```

---

## AuthHook

```typescript
type AuthHook = {
  provider: string;
  loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>;
  methods: Array<
    | { type: 'oauth'; label: string; authorize(inputs?): Promise<AuthOAuthResult> }
    | {
        type: 'api';
        label: string;
        authorize?(inputs?): Promise<{ type: 'success'; key: string } | { type: 'failed' }>;
      }
  >;
};
```

`loader`의 반환 객체에 `fetch` 키로 커스텀 fetch 함수를 넣으면 해당 프로바이더 요청에 자동 적용됨 (helicone 패턴).

---

## Event Types (주요)

`event` 훅에서 `event.type`으로 분기:

```
session.created / session.updated / session.deleted / session.idle
session.compacted / session.error / session.status / session.diff
message.updated / message.removed
message.part.updated / message.part.removed  ← 툴 결과 추적 시 핵심
tool.execute.before / tool.execute.after     ← 직접 훅으로도 수신 가능
file.edited / file.watcher.updated
lsp.client.diagnostics / lsp.updated
permission.asked / permission.replied
installation.updated
server.connected
tui.prompt.append / tui.command.execute / tui.toast.show
shell.env
command.executed
todo.updated
```

### message.part.updated 구조

```typescript
{
  type: "message.part.updated",
  properties: {
    part: {
      id: string
      sessionID: string
      messageID: string
      type: "tool"
      callID: string          // 중복 방지용 키
      tool: string            // 툴 이름 (e.g. "read", "edit", "bash")
      state: {
        status: "completed" | "running" | "error"
        // status === "completed" 일 때만 아래 필드 존재:
        input: Record<string, unknown>
        output: string
        title: string
        metadata: Record<string, unknown>  // filediff, filepath 등 툴별 상이
        time: { start: number; end: number }
      }
    }
  }
}
```

---

## SDK Client (ctx.client) 주요 메서드

```typescript
// 로깅
client.app.log({ body: { service, level, message, extra? } })

// 세션
client.session.list()
client.session.get({ path: { id } })
client.session.prompt({ path: { id }, body: { parts, model?, noReply? } })
client.session.messages({ path: { id } })

// 파일
client.find.text({ query: { pattern } })
client.find.files({ query: { query, type?, limit? } })
client.file.read({ query: { path } })

// TUI
client.tui.showToast({ body: { message, variant } })  // variant: "success"|"error"|"info"
client.tui.appendPrompt({ body: { text } })

// 이벤트 스트림
const events = await client.event.subscribe()
for await (const event of events.stream) { ... }
```
