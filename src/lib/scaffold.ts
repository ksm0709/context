import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '../constants';
import { resolveContextDir } from './context-dir';
import pkg from '../../package.json';

const PLUGIN_VERSION: string = pkg.version;

const DEFAULT_CONFIG = `{
  // Context Plugin Configuration
  // See: https://github.com/ksm0709/context
  "prompts": {
    "turnStart": "prompts/turn-start.md",
    "turnEnd": "prompts/turn-end.md"
  },
  "knowledge": {
    "dir": "docs",
    "sources": ["AGENTS.md"]
  },
  "omx": {
    // Inject turn-end after native turn-complete via tmux send-keys
    "turnEnd": {
      "strategy": "turn-complete-sendkeys"
    }
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

- 
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

const DEFAULT_TURN_END = `## TURN END 작업 지침
아래 메뉴 중 하나를 선택해 진행 상황에 맞게 수행하세요.
**반드시 링크된 가이드를 참고하여 정확히 수행해야 합니다.**

1. **계속 작업**: 기존 작업이 완료되지 않았고 아직 아래 액션을 취할 단계가 아니라면 작업 속개.
2. **데일리 노트 기록**: [.context/guides/daily-note-guide.md] 데일리 노트에 중요한 컨텍스트를 기록하여 다음 세션이나 에이전트 팀이 참고할 수 있도록 하세요. 기존 내용 수정은 불가하며, 새로운 메모를 추가 하는것만 가능합니다. 간략한 한 두 문장으로 작성하여 핵심 컨텍스트가 명확히 전달되도록 하세요.
3. **지식 노트 작성**: [.context/guides/note-guide.md] 작업기억(데일리노트, 세션 컨텍스트)보다 오래 기억되어야 하는 중요한 결정, 패턴, 실수, 발견은 지식 노트로 기록하여 프로젝트의 집단 지식으로 남기세요.
4. **노트/스킬 검색 및 읽기**: [.context/guides/search-guide.md] 어려움에 처했다면 현재 진행 상황에 필요한 지식이나 스킬이 있는지 확인하고, 관련 노트를 읽어보세요. 새로운 아이디어나 해결책이 떠오를 수 있습니다.
5. **작업 경로 리뷰**: [.context/guides/scope-review.md] 사용자가 의도한 작업 범위를 벗어나지 않았는지, 작업이 너무 크거나 복잡해지지는 않았는지 검토하세요.
6. **체크포인트 커밋**: [.context/guides/commit-guide.md] 작업이 길어질 경우, 중요한 단계마다 체크포인트 커밋을 하여 작업 내용을 안전하게 저장하고, 필요 시 이전 상태로 돌아갈 수 있도록 하세요.
7. **퀄리티 검증**: [.context/guides/quality-check.md] **작업 완료 전에 반드시 수행하세요**. 코드 린트, 포맷터, 테스트, 빌드, 코드리뷰를 실행하여 작업 결과물이 프로젝트의 품질 기준을 충족하는지 확인하세요.
8. **작업 완료**: [.context/guides/complete-guide.md] 모든 작업이 완료되었다면, 이 가이드를 따르세요. 이 작업 지침이 더이상 트리거되지 않을 것입니다.
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

const GUIDE_FILES: Record<string, string> = {
  'daily-note-guide.md':
    '# 데일리 노트 기록 가이드\n\n- [ ] YYYY-MM-DD.md 데일리노트 읽기\n- [ ] 기억해야 하는 작업내용 1-2문장으로 요약하여 기록',
  'note-guide.md':
    '# 지식 노트 작성 가이드\n\n- [ ] 주제 정의\n- [ ] 관련 노트 연결\n- [ ] 자기 언어로 서술',
  'search-guide.md':
    '# 노트/스킬 검색 및 읽기 가이드\n\n- [ ] 관련 키워드 검색\n- [ ] INDEX.md 확인\n- [ ] 관련 노트 탐색',
  'quality-check.md':
    '# 퀄리티 검증 가이드\n\n- [ ] Lint/Format 확인\n- [ ] 테스트 실행\n- [ ] 빌드 확인\n- [ ] 코드 리뷰 요청 및 통과',
  'scope-review.md':
    '# 작업 경로 리뷰 가이드\n\n- [ ] 현재 작업 범위 확인\n- [ ] 스코프 이탈 여부 검토',
  'commit-guide.md':
    '# 체크포인트 커밋 가이드\n\n- [ ] 작업 내용 스테이징\n- [ ] 원자적 커밋 메시지 작성',
  'complete-guide.md':
    '# 작업 완료 가이드\n\n- [ ] .context/.work-complete 생성\n- [ ] 세션/턴 ID 기록',
};

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
  const contextDir = join(projectDir, resolveContextDir(projectDir));

  // Idempotency check: if context dir exists, skip scaffolding
  if (existsSync(contextDir)) {
    return false;
  }

  try {
    const promptsDir = join(contextDir, 'prompts');
    mkdirSync(promptsDir, { recursive: true });

    const templatesDir = join(contextDir, 'templates');
    mkdirSync(templatesDir, { recursive: true });

    const guidesDir = join(contextDir, 'guides');
    mkdirSync(guidesDir, { recursive: true });

    writeFileSync(join(contextDir, 'config.jsonc'), DEFAULT_CONFIG, 'utf-8');
    writeFileSync(join(promptsDir, DEFAULTS.turnStartFile), DEFAULT_TURN_START, 'utf-8');
    writeFileSync(join(promptsDir, DEFAULTS.turnEndFile), DEFAULT_TURN_END, 'utf-8');

    for (const [filename, content] of Object.entries(TEMPLATE_FILES)) {
      writeFileSync(join(templatesDir, filename), content, 'utf-8');
    }

    for (const [filename, content] of Object.entries(GUIDE_FILES)) {
      writeFileSync(join(guidesDir, filename), content, 'utf-8');
    }

    writeVersion(contextDir, PLUGIN_VERSION);

    return true;
  } catch {
    return false;
  }
}

export function updateScaffold(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
  mkdirSync(join(contextDir, 'prompts'), { recursive: true });
  mkdirSync(join(contextDir, 'templates'), { recursive: true });
  mkdirSync(join(contextDir, 'guides'), { recursive: true });

  const templateEntries = Object.fromEntries(
    Object.entries(TEMPLATE_FILES).map(([filename, content]) => [`templates/${filename}`, content])
  );

  const guideEntries = Object.fromEntries(
    Object.entries(GUIDE_FILES).map(([filename, content]) => [`guides/${filename}`, content])
  );

  const templates: Record<string, string> = {
    'config.jsonc': DEFAULT_CONFIG,
    [`prompts/${DEFAULTS.turnStartFile}`]: DEFAULT_TURN_START,
    [`prompts/${DEFAULTS.turnEndFile}`]: DEFAULT_TURN_END,
    ...templateEntries,
    ...guideEntries,
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
 * Read stored plugin version from the resolved context directory.
 * Returns null if file is missing or unreadable.
 */
export function getStoredVersion(projectDir: string): string | null {
  try {
    return readFileSync(
      join(projectDir, resolveContextDir(projectDir), '.version'),
      'utf-8'
    ).trim();
  } catch {
    return null;
  }
}

/**
 * Write plugin version to the resolved context directory.
 */
export function writeVersion(contextDir: string, version: string): void {
  writeFileSync(join(contextDir, '.version'), version, 'utf-8');
}

/**
 * Auto-update templates, guides, and prompts when plugin version changes.
 * Skips config.jsonc to preserve user customizations.
 * Returns list of updated paths, or empty array if nothing changed.
 */
export function autoUpdateTemplates(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
  if (!existsSync(contextDir)) return [];

  const stored = getStoredVersion(projectDir);
  if (stored === PLUGIN_VERSION) return [];

  mkdirSync(join(contextDir, 'prompts'), { recursive: true });
  mkdirSync(join(contextDir, 'templates'), { recursive: true });
  mkdirSync(join(contextDir, 'guides'), { recursive: true });

  const filesToUpdate: Record<string, string> = {
    [`prompts/${DEFAULTS.turnStartFile}`]: DEFAULT_TURN_START,
    [`prompts/${DEFAULTS.turnEndFile}`]: DEFAULT_TURN_END,
    ...Object.fromEntries(Object.entries(TEMPLATE_FILES).map(([f, c]) => [`templates/${f}`, c])),
    ...Object.fromEntries(Object.entries(GUIDE_FILES).map(([f, c]) => [`guides/${f}`, c])),
  };

  const updated: string[] = [];
  for (const [path, content] of Object.entries(filesToUpdate)) {
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

export function updatePrompts(projectDir: string): string[] {
  const contextDir = join(projectDir, resolveContextDir(projectDir));
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
