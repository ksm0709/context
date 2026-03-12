# Gotcha: Bun -- Vitest 환경에서 전역 객체 직접 참조 시 ReferenceError

## 예상 vs 실제

**예상**: 공용 유틸리티에서 Bun 전역 객체를 쓰더라도, Vitest에서는 해당 코드가 실제로 필요할 때만 평가되거나 안전하게 우회될 것으로 기대.

**실제**: 테스트가 Bun이 없는 런타임에서 실행되면 `Bun.main`, `Bun.file` 같은 전역 참조가 모듈 로드 시점이나 분기 평가 시점에 바로 터져 `ReferenceError: Bun is not defined`가 발생한다.

```ts
// Vitest/Node 환경에서 바로 실패할 수 있는 패턴
const isMainModule: boolean = import.meta.path === Bun.main;
```

## 우회법

Bun 전역 객체를 읽기 전에 항상 `typeof Bun !== 'undefined'`로 런타임을 먼저 확인한다.

```ts
const isBunRuntime: boolean = typeof Bun !== 'undefined';

const isMainModule: boolean = isBunRuntime && import.meta.path === Bun.main;
```

Bun 전용 분기 안에서만 `Bun.*`를 접근하게 만들면 Vitest에서는 안전하게 fallback 경로만 검증할 수 있다.

## 원인 (알려진 경우)

`Bun`은 모든 JavaScript 런타임에 존재하는 전역이 아니다. 그래서 식 안에서 식별자를 바로 읽으면, 해당 전역이 없는 환경에서는 조건 분기 전에 식별자 해석 자체가 실패한다.

`typeof Bun !== 'undefined'` 검사는 전역이 없어도 예외를 던지지 않으므로, Bun 전용 코드와 범용 코드를 같은 모듈에 둘 때 가장 단순한 보호막이 된다.

## 관련

- [[docs/gotcha-bun-cli-node-reference-error.md]] — Bun 전역 객체가 node 런타임에서 깨지는 더 큰 호환성 문제
- [[docs/gotcha-bun-test-vitest-api-incompatibility.md]] — Bun과 Vitest 러너 차이로 생기는 다른 테스트 gotcha
