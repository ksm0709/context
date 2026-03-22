# Bug: [간단한 설명]

## 증상

- 에러 메시지: `...`
- 관찰된 동작: ...

## 원인

실제 원인 분석

## 해결

// 수정 코드

## 예방

향후 같은 문제를 방지하는 방법

## 관련 노트

- [[유사-버그.md]] / [[예방-패턴.md]]


# Bug: OMX(Codex) MCP 툴 목록(none) 표시 버그

## 증상
- 최신 `@modelcontextprotocol/sdk/server/mcp.js`의 `McpServer` 클래스를 사용해 툴을 등록했을 때, `codex mcp list`나 `omx mcp list`에서 `Tools: (none)`으로 표시되며 사용할 수 없는 문제.
- 다른 MCP 서버(저수준 `Server` 클래스 사용)는 정상 동작.

## 원인
- `McpServer`는 툴 목록 반환 시 `tools/list` 스키마 응답에 `execution: { taskSupport: 'forbidden' }` 및 `inputSchema` 내에 `$schema` 필드를 자동으로 주입함.
- `omx` 내부에서 사용되는 `codex` CLI 바이너리(Rust 구현체)는 MCP 프로토콜 파싱 시 스펙(Struct)에 명시되지 않은 미지의 필드가 들어오면 역직렬화(Deserialization)에 실패하고 해당 툴을 통째로 누락(Drop)함. (Strict Deserialization 방식 사용)

## 해결 (Workaround)
- `server.server.setRequestHandler(ListToolsRequestSchema, ...)`를 재정의하여 기존 핸들러 결과를 가로챈 뒤 호환성을 깨는 필드(`execution`, `$schema`)를 수동으로 제거(delete) 후 반환.
- 이로써 `codex`가 툴의 파라미터를 정상적으로 인식하게 됨.

## 관련 코드
```typescript
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// 기존 ListTools 핸들러 추출
const listToolsMethod = ListToolsRequestSchema.shape.method.value;
const originalListToolsHandler = (server.server as any)._requestHandlers?.get(listToolsMethod);

if (originalListToolsHandler) {
  server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const response = await originalListToolsHandler(request, extra);
    if (response.tools) {
      response.tools = response.tools.map((tool: any) => {
        const newTool = { ...tool };
        delete newTool.execution;
        if (newTool.inputSchema && newTool.inputSchema.$schema) {
          delete newTool.inputSchema.$schema;
        }
        return newTool;
      });
    }
    return response;
  });
}
```