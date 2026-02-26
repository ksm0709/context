# Synthetic 메시지 주입의 한계와 대안

OpenCode 플러그인에서 `synthetic: true` 플래그를 사용한 메시지 주입 방식의 문제점과 더 효과적인 대안 전략을 정리합니다.

## 발견한 문제

### 1. UI 표시 불일치

`synthetic: true`로 생성된 TextPart는 OpenCode UI에 표시되지 않을 수 있습니다. 이는 OpenCode 버전이나 설정에 따라 다르게 동작하며, 예측할 수 없는 UX 문제를 야기합니다.

### 2. AI의 행동 차이

AI는 `synthetic: true` 메시지를 soft context나 background 정보로 취급하는 경향이 있습니다. 이로 인해 lint 실행, 파일 작성 등 실제 도구 호출로 이어지지 않는 경우가 발생합니다.

## 대안 전략

`synthetic` 플래그 없이 더 효과적인 메시지 주입 방법들:

### turn-start: 마지막 유저 메시지에 TextPart 추가

```typescript
// 마지막 UserMessage의 parts[]에 새 TextPart를 append
const lastUserMessage = findLastUserMessage(messages);
lastUserMessage.parts.push({
  type: 'text',
  text: '추가 컨텍스트 내용',
  // synthetic 플래그 생략
});
```

### turn-end: 별도 유저 메시지로 추가

```typescript
// output.messages.push()로 새 UserMessage 추가
output.messages.push({
  role: 'user',
  parts: [{ type: 'text', text: '리마인더 내용' }],
  // synthetic 플래그 생략
});
```

### system.transform: knowledge index 유지

UI와 무관하게 AI 컨텍스트에 지식을 주입해야 할 때는 `system.transform` 훅을 사용하여 knowledge index만 주입합니다. 이는 시스템 레벨 컨텍스트로 동작합니다.

## 왜 유저 메시지 방식이 더 효과적인가

LLM은 메시지 역할을 다음과 같이 해석합니다:

| 역할        | LLM의 인식        | 행동 유발력        |
| ----------- | ----------------- | ------------------ |
| `user`      | "지금 해야 할 일" | 높음 (즉각적 액션) |
| `system`    | "규칙/지침"       | 중간 (참고용)      |
| `assistant` | "자신의 응답"     | 낮음 (이미 한 말)  |

`synthetic: true` 메시지는 AI가 "이미 처리한 정보"로 인식할 가능성이 높습니다. 반면 일반 `user` 메시지는 "새로운 요청/작업"으로 인식하여 즉각적인 액션을 유발할 가능성이 높습니다.

## 결론

- `synthetic: true`는 UI 표시 문제와 AI 행동 예측 실패를 야기할 수 있습니다
- 실제 도구 호출을 유발하려면 일반 `user` 메시지 방식을 사용하세요
- `system.transform`은 지식 주입용으로, `messages.transform`은 리마인더/액션 유발용으로 구분하여 사용하세요

## 관련 아키텍처

- [[architecture.md]] — 플러그인 전체 아키텍처 개요
