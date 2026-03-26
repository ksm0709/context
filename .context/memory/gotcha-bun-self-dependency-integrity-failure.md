# Gotcha: [라이브러리] -- [함정 설명]

## 예상 vs 실제

예상한 동작과 실제 동작의 차이

## 우회법

// 작동하는 해결 코드

## 원인 (알려진 경우)

왜 이렇게 동작하는지

## 관련

- 이슈: [GitHub issue / 문서 링크]
- [[관련-gotcha.md]]


A package accidentally listing itself in `dependencies` can publish successfully to npm but break Bun-based consumers. In this repo, `@ksm0709/context` was listed as a dependency of `@ksm0709/context`, which made `context update plugin` fail on the local Bun install step with an integrity/extraction error. Guard against this with a regression test that reads `package.json` and asserts the package name is absent from both `dependencies` and `devDependencies`.
## Related Notes

- [[runbook-context-plugin-release]]
