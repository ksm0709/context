# Decision: Vitest ESM 모듈 모킹 시 vi.spyOn 대신 vi.mock 사용

## 결정

`src/cli/commands/update.test.ts`를 포함한 테스트 환경에서 ESM 모듈의 함수를 모킹할 때 `vi.spyOn` 대신 `vi.mock`을 사용하기로 결정했습니다.

## 근거

ESM 모듈의 export는 읽기 전용 네임스페이스로 취급되어, 런타임에 `vi.spyOn`으로 속성을 재정의하려고 하면 `Module namespace is not configurable` 에러가 발생합니다. `vi.mock`을 사용하여 모듈 전체를 모킹함으로써 이 문제를 회피하고 안정적인 테스트를 수행할 수 있습니다.

## 고려한 대안

- `vi.spyOn`: ESM 환경에서 모듈 네임스페이스 제약으로 인해 실패함.
- 함수를 객체로 감싸서 export: 모킹은 가능해지나, 기존 코드 구조를 변경해야 하므로 배제함.

## 관련 노트

- [[docs/gotcha-bun-vitest-esm-spy-error.md]]
