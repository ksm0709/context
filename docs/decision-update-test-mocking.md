# Decision: src/cli/commands/update.test.ts에서 vi.spyOn 대신 vi.mock 사용으로 ESM 호환성 개선

## 결정
`src/cli/commands/update.test.ts`에서 `node:fs` 모듈의 `existsSync` 함수를 모킹할 때 `vi.spyOn` 대신 `vi.mock`을 사용하기로 결정했습니다.

## 이유
ESM 모듈의 함수는 `vi.spyOn`으로 모킹할 때 `Module namespace is not configurable` 에러가 발생합니다. `vi.mock`을 사용하여 모듈 전체를 모킹함으로써 이 문제를 해결했습니다.
