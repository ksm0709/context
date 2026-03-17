import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '../constants';
import pkg from '../../package.json';

const PLUGIN_VERSION: string = pkg.version;

const DEFAULT_CONFIG = `{
  // Context Plugin Configuration
  // See: https://github.com/ksm0709/context
  "prompts": {
    "turnStart": ".opencode/context/prompts/turn-start.md",
    "turnEnd": ".opencode/context/prompts/turn-end.md"
  },
  "knowledge": {
    "dir": "docs",
    "sources": ["AGENTS.md"]
  }
}`;

const DEFAULT_TURN_START = `## Knowledge Context

이 프로젝트는 **제텔카스텐(Zettelkasten)** 방식으로 지식을 관리합니다.
세션 간 컨텍스트를 보존하여, 이전 세션의 결정/패턴/실수가 다음 세션에서 재활용됩니다.

### 제텔카스텐 핵심 원칙

1. **원자성** -- 하나의 노트 = 하나의 주제. 여러 주제를 섞지 마세요.
2. **연결** -- 모든 노트는 [[wikilink]]로 관련 노트에 연결. 고립된 노트는 발견되지 않습니다.
3. **자기 언어** -- 복사-붙여넣기가 아닌, 핵심을 이해하고 간결하게 서술하세요.

### 작업 전 필수

- 메인 에이전트가 아래 **Available Knowledge** 목록에서 현재 작업과 관련된 문서를 **직접 먼저** 읽으세요
- 도메인 폴더 구조가 있다면 INDEX.md의 요약을 참고하여 필요한 노트만 선택적으로 읽으세요
- 문서 내 [[링크]]를 따라가며 관련 노트를 탐색하세요 -- 링크를 놓치면 중요한 맥락을 잃습니다
- 지식 파일에 기록된 아키텍처 결정, 패턴, 제약사항을 반드시 따르세요
- 읽은 지식을 현재 작업의 설계, 구현, 검증에 직접 반영하세요

### 개발 원칙

- **TDD** (Test-Driven Development): 테스트를 먼저 작성하고(RED), 구현하여 통과시킨 뒤(GREEN), 리팩토링하세요
- **DDD** (Domain-Driven Design): 도메인 개념을 코드 구조에 반영하세요. 타입과 모듈은 비즈니스 도메인을 기준으로 분리하세요
- **테스트 커버리지**: 새로 작성하거나 변경한 코드는 테스트 커버리지 80% 이상을 목표로 하세요. 구현 전에 테스트부터 작성하면 자연스럽게 달성됩니다

### 우선순위

- AGENTS.md의 지시사항이 항상 최우선
- 지식 노트의 결정사항 > 일반적 관행
- 지식 노트에 없는 새로운 결정이나 반복 가치가 있는 발견은 작업 메모나 지식 노트 후보로 기록하세요
`;

const DEFAULT_TURN_END = `## 작업 마무리

작업이 완료되면 아래 항목을 메인 에이전트가 직접 확인하세요.

### 1. 퀄리티 체크

- 변경한 코드에 대해 필요한 lint, format, test, build 검증을 직접 실행하세요
- 새로 작성하거나 변경한 코드의 커버리지 기대치를 확인하세요
- 변경 범위를 검토하여 요청과 무관한 파일을 건드리지 않았는지 확인하세요
- 실패 항목이 있으면 원인, 에러 메시지, 관련 파일 위치를 정리한 뒤 직접 수정하세요
- 작업이 끝났다고 판단하기 전에 위 검증 결과를 직접 다시 확인하세요

### 2. 지식 정리

작업 중 기록할 만한 발견이 있었다면 직접 정리하세요.

**기록 대상 판단 기준:**

| 상황                            | 템플릿                                              | 파일명 패턴                 |
| ------------------------------- | --------------------------------------------------- | --------------------------- |
| 아키텍처/기술 스택 중대 결정    | [ADR](.opencode/context/templates/adr.md)           | \`adr-NNN-제목.md\`           |
| 반복 사용할 코드 패턴 발견      | [Pattern](.opencode/context/templates/pattern.md)   | \`pattern-제목.md\`           |
| 비자명한 버그 해결              | [Bug](.opencode/context/templates/bug.md)           | \`bug-제목.md\`               |
| 외부 API/라이브러리 예상외 동작 | [Gotcha](.opencode/context/templates/gotcha.md)     | \`gotcha-라이브러리-제목.md\` |
| 작은 기술적 선택                | [Decision](.opencode/context/templates/decision.md) | \`decision-제목.md\`          |
| 모듈/프로젝트 개요 필요         | [Context](.opencode/context/templates/context.md)   | \`context-제목.md\`           |
| 반복 가능한 프로세스 정립       | [Runbook](.opencode/context/templates/runbook.md)   | \`runbook-제목.md\`           |
| 실험/디버깅 중 학습             | [Insight](.opencode/context/templates/insight.md)   | \`insight-제목.md\`           |

해당 사항이 없으면 이 단계는 건너뛰세요.

- 관련 템플릿 파일을 읽고 그 구조에 맞춰 내용을 정리하세요
- 노트 첫 줄은 명확한 제목(\`# Title\`)으로 시작하세요
- 핵심 내용을 자기 언어로 간결하게 서술하고, 관련 노트는 \`[[relative/path/file.md]]\` 형태로 연결하세요
- knowledge 디렉토리(\`{{knowledgeDir}}/\`) 또는 적절한 도메인 폴더에 저장하고, 필요한 경우 기존 INDEX.md나 관련 노트를 함께 갱신하세요

기존 설치의 사용자 프롬프트 파일은 자동으로 바뀌지 않습니다. 새 기본 프롬프트가 필요하면 \`context update prompt\`로 명시적으로 새로고침하세요.
`;

const DEFAULT_ADR_TEMPLATE = `# ADR-NNN: [제목]

## 상태

Accepted | Deprecated | Superseded by [[ADR-YYY]]

## 맥락

이 결정을 내리게 된 배경/문제 상황

## 결정

무엇을 어떻게 하기로 했는지

## 결과

### 긍정적

- ...

### 부정적 (트레이드오프)

- ...

## 관련 노트

- [[관련-결정.md]] / [[관련-패턴.md]]
`;

const DEFAULT_PATTERN_TEMPLATE = `# Pattern: [패턴 이름]

## 문제

이 패턴이 해결하는 문제

## 해법

// 패턴의 대표적 예시 코드

## 사용 시점

- 이럴 때 사용

## 사용하지 말 것

- 이럴 때는 사용 금지 (안티패턴 경고)

## 코드베이스 내 예시

- [[경로/파일.ts]] -- 실제 적용 사례

## 관련 패턴

- [[대안-패턴.md]] / [[보완-패턴.md]]
`;

const DEFAULT_BUG_TEMPLATE = `# Bug: [간단한 설명]

## 증상

- 에러 메시지: \`...\`
- 관찰된 동작: ...

## 원인

실제 원인 분석

## 해결

// 수정 코드

## 예방

향후 같은 문제를 방지하는 방법

## 관련 노트

- [[유사-버그.md]] / [[예방-패턴.md]]
`;

const DEFAULT_GOTCHA_TEMPLATE = `# Gotcha: [라이브러리] -- [함정 설명]

## 예상 vs 실제

예상한 동작과 실제 동작의 차이

## 우회법

// 작동하는 해결 코드

## 원인 (알려진 경우)

왜 이렇게 동작하는지

## 관련

- 이슈: [GitHub issue / 문서 링크]
- [[관련-gotcha.md]]
`;

const DEFAULT_DECISION_TEMPLATE = `# Decision: [제목]

## 결정

무엇을 선택했는지

## 근거

왜 이것을 선택했는지

## 고려한 대안

- 대안 1: 탈락 이유
- 대안 2: 탈락 이유

## 관련 노트

- [[관련-ADR.md]] / [[관련-패턴.md]]
`;

const DEFAULT_CONTEXT_TEMPLATE = `# Context: [프로젝트/모듈명]

## 개요

무엇이고 무엇을 하는지

## 기술 스택

- 언어 / 프레임워크 / 주요 라이브러리

## 아키텍처

고수준 구조와 패턴

## 컨벤션

- 파일 구조 / 네이밍 / 테스트 방식

## 진입점

- [[src/index.ts]] / [[config.json]]

## 관련 노트

- [[관련-context.md]] / [[주요-ADR.md]]
`;

const DEFAULT_RUNBOOK_TEMPLATE = `# Runbook: [절차 이름]

## 목적

이 절차가 달성하는 것

## 사전 조건

- 필요한 것 1

## 단계

1. 첫 번째 단계
2. 두 번째 단계

## 확인 방법

성공했는지 확인하는 방법

## 문제 해결

| 증상   | 해결            |
| ------ | --------------- |
| 이슈 1 | [[관련-bug.md]] |

## 관련 노트

- [[관련-runbook.md]] / [[관련-context.md]]
`;

const DEFAULT_INSIGHT_TEMPLATE = `# Insight: [발견 제목]

## 발견

무엇을 알게 되었는지

## 맥락

어떻게 발견했는지 (어떤 작업 중, 어떤 실험)

## 시사점

이것이 향후 작업에 미치는 영향

## 적용

이 발견을 바탕으로 어떻게 행동을 바꿔야 하는지

## 관련 노트

- [[관련-insight.md]] / [[영향받는-패턴.md]] / [[관련-ADR.md]]
`;

const DEFAULT_INDEX_TEMPLATE = `# [Domain] Domain

Overview: [1-2 sentence description of this domain]

## Notes

| File | Summary | Read When... |
|------|---------|--------------|
| [[example.md]] | Example summary | Working on X |

## Related Domains

- [[../other-domain/INDEX.md]] -- Description
`;

const TEMPLATE_FILES: Record<string, string> = {
  'adr.md': DEFAULT_ADR_TEMPLATE,
  'pattern.md': DEFAULT_PATTERN_TEMPLATE,
  'bug.md': DEFAULT_BUG_TEMPLATE,
  'gotcha.md': DEFAULT_GOTCHA_TEMPLATE,
  'decision.md': DEFAULT_DECISION_TEMPLATE,
  'context.md': DEFAULT_CONTEXT_TEMPLATE,
  'runbook.md': DEFAULT_RUNBOOK_TEMPLATE,
  'insight.md': DEFAULT_INSIGHT_TEMPLATE,
  'index.md': DEFAULT_INDEX_TEMPLATE,
};

export function scaffoldIfNeeded(projectDir: string): boolean {
  const contextDir = join(projectDir, '.opencode', 'context');

  // Idempotency check: if context dir exists, skip scaffolding
  if (existsSync(contextDir)) {
    return false;
  }

  try {
    const promptsDir = join(contextDir, 'prompts');
    mkdirSync(promptsDir, { recursive: true });

    const templatesDir = join(contextDir, 'templates');
    mkdirSync(templatesDir, { recursive: true });

    writeFileSync(join(contextDir, 'config.jsonc'), DEFAULT_CONFIG, 'utf-8');
    writeFileSync(join(promptsDir, DEFAULTS.turnStartFile), DEFAULT_TURN_START, 'utf-8');
    writeFileSync(join(promptsDir, DEFAULTS.turnEndFile), DEFAULT_TURN_END, 'utf-8');

    for (const [filename, content] of Object.entries(TEMPLATE_FILES)) {
      writeFileSync(join(templatesDir, filename), content, 'utf-8');
    }

    writeVersion(contextDir, PLUGIN_VERSION);

    return true;
  } catch {
    return false;
  }
}

export function updateScaffold(projectDir: string): string[] {
  const contextDir = join(projectDir, '.opencode', 'context');
  mkdirSync(join(contextDir, 'prompts'), { recursive: true });
  mkdirSync(join(contextDir, 'templates'), { recursive: true });

  const templateEntries = Object.fromEntries(
    Object.entries(TEMPLATE_FILES).map(([filename, content]) => [`templates/${filename}`, content])
  );

  const templates: Record<string, string> = {
    'config.jsonc': DEFAULT_CONFIG,
    [`prompts/${DEFAULTS.turnStartFile}`]: DEFAULT_TURN_START,
    [`prompts/${DEFAULTS.turnEndFile}`]: DEFAULT_TURN_END,
    ...templateEntries,
  };

  const updated: string[] = [];
  for (const [path, content] of Object.entries(templates)) {
    const filePath = join(contextDir, path);
    try {
      const existing = readFileSync(filePath, 'utf-8');
      if (existing === content) continue;
    } catch {
      /* file missing — will create */
    }
    writeFileSync(filePath, content, 'utf-8');
    updated.push(path);
  }
  writeVersion(contextDir, PLUGIN_VERSION);
  return updated;
}

/**
 * Read stored plugin version from .opencode/context/.version.
 * Returns null if file is missing or unreadable.
 */
export function getStoredVersion(projectDir: string): string | null {
  try {
    return readFileSync(join(projectDir, '.opencode', 'context', '.version'), 'utf-8').trim();
  } catch {
    return null;
  }
}

/**
 * Write plugin version to .opencode/context/.version.
 */
export function writeVersion(contextDir: string, version: string): void {
  writeFileSync(join(contextDir, '.version'), version, 'utf-8');
}

/**
 * Auto-update templates only when plugin version changes.
 * Skips config.jsonc and prompts/ to preserve user customizations.
 * Returns list of updated template paths, or empty array if nothing changed.
 */
export function autoUpdateTemplates(projectDir: string): string[] {
  const contextDir = join(projectDir, '.opencode', 'context');
  if (!existsSync(contextDir)) return [];

  const stored = getStoredVersion(projectDir);
  if (stored === PLUGIN_VERSION) return [];

  mkdirSync(join(contextDir, 'templates'), { recursive: true });

  const updated: string[] = [];
  for (const [filename, content] of Object.entries(TEMPLATE_FILES)) {
    const filePath = join(contextDir, 'templates', filename);
    try {
      const existing = readFileSync(filePath, 'utf-8');
      if (existing === content) continue;
    } catch {
      /* file missing — will create */
    }
    writeFileSync(filePath, content, 'utf-8');
    updated.push(`templates/${filename}`);
  }

  writeVersion(contextDir, PLUGIN_VERSION);
  return updated;
}

export function updatePrompts(projectDir: string): string[] {
  const contextDir = join(projectDir, '.opencode', 'context');
  mkdirSync(join(contextDir, 'prompts'), { recursive: true });

  const prompts: Record<string, string> = {
    [`prompts/${DEFAULTS.turnStartFile}`]: DEFAULT_TURN_START,
    [`prompts/${DEFAULTS.turnEndFile}`]: DEFAULT_TURN_END,
  };

  const updated: string[] = [];
  for (const [path, content] of Object.entries(prompts)) {
    const filePath = join(contextDir, path);
    try {
      const existing = readFileSync(filePath, 'utf-8');
      if (existing === content) continue;
    } catch {
      /* file missing — will create */
    }
    writeFileSync(filePath, content, 'utf-8');
    updated.push(path);
  }
  return updated;
}
