# Pattern: Prompt Template Variable Resolution

## 문제

프롬프트 파일(`.md`)은 사용자가 편집 가능한 정적 파일로 저장되지만, 런타임에 config 값(예: `knowledge.dir`)을 반영해야 할 때 하드코딩된 예시 값이 실제 설정과 달라 에이전트가 잘못된 경로를 참조한다.

## 해법

프롬프트 파일에 `{{variableName}}` 플레이스홀더를 사용하고, 인젝션 시점에 `resolvePromptVariables()`로 치환한다.

```typescript
// src/lib/prompt-reader.ts
export interface PromptVariables {
  knowledgeDir: string;
}

export function resolvePromptVariables(content: string, vars: PromptVariables): string {
  const normalized = (vars.knowledgeDir || 'docs')
    .replace(/\\/g, '/') // Windows backslash 정규화
    .replace(/\/+$/, ''); // trailing slash 제거
  return content.replaceAll('{{knowledgeDir}}', normalized);
}

// src/index.ts — 훅 내부 (매 턴 실행)
const promptVars = { knowledgeDir: config.knowledge.dir ?? 'docs' };
const turnStart = resolvePromptVariables(readPromptFile(turnStartPath), promptVars);
const turnEnd = resolvePromptVariables(readPromptFile(turnEndPath), promptVars);
```

## 사용 시점

- 프롬프트 파일이 정적 파일로 저장되지만 런타임 config 값을 반영해야 할 때
- 사용자가 프롬프트를 직접 편집할 수 있어야 하면서도 동적 값이 필요할 때
- 향후 `{{projectName}}`, `{{templateDir}}` 등 다른 변수 추가가 예상될 때

## 사용하지 말 것

- 복잡한 조건문/반복문이 필요한 경우 → Handlebars 등 전용 템플릿 엔진 고려
- 프롬프트 파일을 사용자가 편집하지 않는 경우 → 코드에서 직접 문자열 생성이 더 단순
- 치환 결과의 파일시스템 검증이 필요한 경우 → 별도 validation 레이어 추가

## 코드베이스 내 예시

- [[src/lib/prompt-reader.ts]] — `resolvePromptVariables()` 구현
- [[src/index.ts]] — `experimental.chat.messages.transform` 훅에서 turn-start/turn-end에 적용
- [[src/lib/scaffold.ts]] — `DEFAULT_TURN_END`에 `{{knowledgeDir}}` 플레이스홀더 사용

## 관련 패턴

- [[docs/adr-001-zettelkasten-hook-templates.md]] — 훅 콘텐츠 템플릿 구조
- [[docs/decision-scaffold-auto-update-scope.md]] — 사용자 프롬프트 파일 자동 갱신 정책
