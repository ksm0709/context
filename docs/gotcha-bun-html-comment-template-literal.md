# Gotcha: Bun -- TypeScript 템플릿 리터럴 내 <!-- HTML 주석 파싱 버그

## 예상 vs 실제

TypeScript 소스 파일의 템플릿 리터럴 내부에 `<!--` 시퀀스를 포함하면, Bun은 이를 HTML 레거시 주석으로 잘못 인식하여 `Unsupported syntax: Legacy HTML comments not implemented yet!` 오류를 발생시킵니다.

## 우회법

템플릿 리터럴 내부에서 `<!--`가 직접 나타나지 않도록 `${'<'}`를 사용하여 `<` 문자를 동적으로 생성합니다.

```typescript
// ✅ 올바른 방법: ${'<'} 이스케이프 사용
const template = `
${'<'}!-- primary-only -->
content
${'<'}!-- /primary-only -->
`;
```

## 원인

Bun의 JavaScript 파서가 ES 스펙의 Annex B에 따라 `<!--`를 HTML 레거시 주석으로 처리하는데, 이 규칙이 템플릿 리터럴 내부에서도 동일하게 적용되기 때문입니다. 특히 줄의 시작 부분에 `<!--`가 위치할 때 파서가 이를 주석으로 오인합니다.

## 관련

- 이슈: Bun v1.3.10 파서 이슈
- [[gotcha-bun-cli-node-reference-error.md]]
- [[decision-subagent-infinite-loop-prevention.md]]
