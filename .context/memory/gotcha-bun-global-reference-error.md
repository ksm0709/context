# Gotcha: Bun -- 테스트 환경에서 전역 객체 Bun 직접 참조 시 ReferenceError

## 예상 vs 실제

**예상**: `Bun` 전역 객체를 사용하여 `Bun.spawnSync`나 `Bun.main` 등을 호출하면 런타임과 동일하게 동작할 것으로 기대.

**실제**: 테스트 환경(Vitest)에서 `ReferenceError: Bun is not defined` 에러가 발생하며 테스트 실패.

## 우회법

`Bun` 전역 객체를 직접 참조하는 대신, `globalThis.Bun`을 사용하여 옵셔널 체이닝(`?.`)을 적용하거나, 테스트 환경에서 `globalThis.Bun`을 모킹(mocking)해야 함.

```ts
// 코드 내 사용 예시
const spawnSync = globalThis.Bun?.spawnSync;

// 테스트 코드 내 모킹 예시
(globalThis as any).Bun = { spawnSync: vi.fn() };
```

## 원인

`Bun` 전역 객체는 Bun 런타임에서만 제공되며, Vitest와 같은 Node.js 기반 테스트 환경에서는 기본적으로 정의되어 있지 않기 때문.

## 관련

- [[docs/gotcha-bun-cli-node-reference-error.md]]
- [[docs/gotcha-bun-vitest-esm-spy-error.md]]
