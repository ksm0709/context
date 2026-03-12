# Pattern: Bun/Vitest ESM Mocking

## 문제

Bun/Vitest 환경에서 ESM 모듈의 함수를 `vi.spyOn`으로 모킹하려고 하면 "Module namespace is not configurable" 에러가 발생합니다. 이는 ESM 모듈의 export가 읽기 전용 네임스페이스로 취급되기 때문입니다.

## 해법

`vi.spyOn` 대신 `vi.mock`을 사용하여 모듈 전체를 모킹하는 것이 안전하고 올바른 패턴입니다.

```ts
vi.mock('module-path', () => ({
  functionName: vi.fn(),
}));
```

## 사용 시점

- Bun/Vitest 환경에서 ESM 모듈의 함수를 모킹해야 할 때.

## 사용하지 말 것

- `vi.spyOn`을 ESM 모듈에 직접 사용하지 마세요.

## 코드베이스 내 예시

- [[src/cli/commands/update.test.ts]] -- 실제 적용 사례
- [[src/cli/cli.test.ts]] -- 실제 적용 사례

## 관련 패턴

- [[docs/gotcha-bun-vitest-esm-spy-error.md]]
