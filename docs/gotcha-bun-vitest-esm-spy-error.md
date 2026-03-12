# Gotcha: Vitest -- ESM 모듈의 함수 모킹 시 Module namespace 에러

## 예상 vs 실제

**예상**: `vi.spyOn(fs, 'existsSync')`와 같이 표준적인 방식으로 ESM 모듈의 함수를 모킹할 수 있을 것으로 기대.

**실제**: `TypeError: Cannot spy on export "existsSync". Module namespace is not configurable in ESM.` 에러가 발생하며 모킹 실패.

## 우회법

ESM 모듈의 함수를 직접 모킹하는 대신, 해당 모듈을 `vi.mock`으로 전체 모킹하거나, 함수를 직접 export하는 대신 객체로 감싸서 export하여 모킹 가능하게 변경해야 함.

```ts
// 해결 예시: 모듈 전체 모킹
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));
```

## 원인 (알려진 경우)

Vitest(및 Jest)에서 ESM 모듈의 export는 읽기 전용(read-only) 네임스페이스로 취급되어, 런타임에 `vi.spyOn`으로 속성을 재정의(redefine)할 수 없기 때문.

## 관련

- 이슈: [Vitest ESM limitations](https://vitest.dev/guide/browser/#limitations)
- [[docs/gotcha-bun-vitest-global-reference-error.md]]
- [[docs/gotcha-bun-cli-node-reference-error.md]]
