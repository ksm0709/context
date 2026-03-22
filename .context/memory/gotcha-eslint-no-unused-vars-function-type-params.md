# Gotcha: eslint -- no-unused-vars가 함수 타입 파라미터명을 unused로 잡음

## 예상 vs 실제

함수 타입 선언의 파라미터명은 단순 문서 목적 — unused로 잡히지 않을 것이라 예상.

```typescript
// 이 코드에서 's'가 no-unused-vars 에러로 잡힘
function printHelp(out?: (s: string) => void): void { ... }
```

실제: `no-unused-vars`가 함수 타입 시그니처 파라미터명까지 검사해 에러를 냄.

## 우회법

`no-unused-vars`를 `off`로 끄고 `@typescript-eslint/no-unused-vars`로 교체.
TS 전용 버전은 함수 타입 선언 파라미터를 올바르게 처리하며, `argsIgnorePattern`으로 `_` 접두사도 지원.

```js
// eslint.config.js
rules: {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
  }],
}
```

## 원인

`no-unused-vars`는 JS 전용 규칙으로 TypeScript 타입 선언의 맥락을 이해하지 못함.
TypeScript 프로젝트에서는 항상 `@typescript-eslint/no-unused-vars`를 사용해야 함.

## 관련

- 이슈: typescript-eslint 공식 문서 — "You should turn off the base rule"
- [[docs/architecture.md]]
