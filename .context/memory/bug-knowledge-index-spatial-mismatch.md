# Bug: knowledge index가 turn-start와 다른 위치에 주입되어 공간적 참조 깨짐

## 증상

- turn-start 프롬프트가 "아래 **Available Knowledge** 목록에서 읽으세요"라고 안내
- 그런데 실제 Available Knowledge 목록이 turn-start 아래에 없음 — AI가 목록을 찾지 못함

## 원인

`prompt-injection-refactor`에서 turn-start를 `system.transform` → `messages.transform`으로 이동할 때, knowledge index는 `system.transform`에 그대로 방치됨.

```
[리팩토링 후 구조]
system.transform  → output.system: [Available Knowledge]   ← 시스템 프롬프트
messages.transform → user message: [turn-start]            ← 유저 메시지
                                   [turn-end]
```

turn-start가 "아래"라고 가리키는 대상이 완전히 다른 레이어(시스템 프롬프트)에 있어서 AI 입장에서 공간적으로 분리됨.

## 해결

knowledge index 빌드 로직을 `system.transform`에서 `messages.transform`으로 이동. turn-start와 `\n\n`으로 결합하여 단일 text part로 주입.

```typescript
// messages.transform 내부
const turnStart = readPromptFile(turnStartPath);
const entries = buildKnowledgeIndex(directory, knowledgeSources);
const indexContent = formatKnowledgeIndex(entries);

const combinedContent = [turnStart, indexContent].filter(Boolean).join('\n\n');
if (combinedContent) {
  lastUserMsg.parts.push({ ..., text: combinedContent });
}
```

결과 구조:

```
messages.transform → user message: [turn-start + Available Knowledge]  ← 하나의 part
                                   [turn-end]
```

## 예방

훅 간 주입 위치를 변경할 때, 프롬프트 내 **공간적 참조**("아래", "위" 등)가 여전히 유효한지 확인할 것. turn-start와 knowledge index는 항상 같은 위치에 있어야 함.

## 관련 노트

- [[docs/adr-001-zettelkasten-hook-templates.md]]
- [[docs/architecture.md]]
