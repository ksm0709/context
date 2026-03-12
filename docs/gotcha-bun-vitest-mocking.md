# Gotcha: Vitest -- Bun 전역 객체 모킹 시 ReferenceError

## 문제

Vitest 환경에서 `Bun` 전역 객체(예: `Bun.spawnSync`)를 직접 참조하거나 모킹하려고 할 때 `ReferenceError: Bun is not defined`가 발생합니다.

## 원인

Vitest는 Node.js 환경에서 실행되므로 `Bun` 전역 객체가 존재하지 않습니다.

## 해결 방법

테스트 파일 상단에서 `globalThis`를 사용하여 `Bun` 객체를 모킹합니다.

```typescript
(globalThis as any).Bun = {
  spawnSync: vi.fn(),
};
```
