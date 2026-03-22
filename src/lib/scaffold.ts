import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveContextDir } from './context-dir';
import pkg from '../../package.json';

const PLUGIN_VERSION: string = pkg.version;

const DEFAULT_CONFIG = `{
  // Context Plugin Configuration
  // See: https://github.com/ksm0709/context
  "knowledge": {
    "dir": ".context/memory",
    "sources": ["AGENTS.md"]
  },
  "omx": {
    // Inject turn-end after native turn-complete via tmux send-keys
    "turnEnd": {
      "strategy": "turn-complete-sendkeys"
    }
  }
}`;

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

const DEFAULT_WORK_COMPLETE_TEMPLATE = `timestamp={{currentTimestamp}}
session_id={{sessionId}}
turn_id={{turnId}}
`;

const DEFAULT_DAILY_NOTE_GUIDE = `# 데일리 노트 기록 가이드

- [ ] \`context_mcp_append_daily_note\` 도구를 사용하여 기록을 추가하세요.
- [ ] **주의**: 데일리 노트의 기존 내용은 절대 수정하거나 삭제하지 마세요.
- [ ] 기록은 다음과 같은 형식으로 추가됩니다:
  \`[{{currentTimestamp}}] <기억 할 내용>\`
- [ ] \`<기억 할 내용>\`에는 완벽한 컨텍스트 인계를 위해 오늘 완료한 핵심 작업 요약, 미해결 이슈(TODO), 중요 메모, 지식 노트 \`[[wikilink]]\` 등을 포함하세요.`;

const DEFAULT_NOTE_GUIDE = `# 지식 노트 작성 및 관리 가이드

- [ ] **노트 생성**: \`context_mcp_create_knowledge_note\` 도구를 사용하여 생성하세요.
- [ ] 제텔카스텐(Zettelkasten) 3대 원칙 준수:
  - [ ] 원자성: 한 노트당 한 주제
  - [ ] 연결: 고립된 노트 방지
  - [ ] 자기 언어 서술: 핵심을 이해하고 간결하게 서술
- [ ] **기록 대상 판단 기준:**

| 상황 | 템플릿 | 파일명 패턴 |
| --- | --- | --- |
| 아키텍처/기술 스택 중대 결정 | \`.context/templates/adr.md\` | \`adr-NNN-제목.md\` |
| 반복 사용할 코드 패턴 발견 | \`.context/templates/pattern.md\` | \`pattern-제목.md\` |
| 비자명한 버그 해결 | \`.context/templates/bug.md\` | \`bug-제목.md\` |
| 외부 API/라이브러리 예상외 동작 | \`.context/templates/gotcha.md\` | \`gotcha-라이브러리-제목.md\` |
| 작은 기술적 선택 | \`.context/templates/decision.md\` | \`decision-제목.md\` |
| 모듈/프로젝트 개요 필요 | \`.context/templates/context.md\` | \`context-제목.md\` |
| 반복 가능한 프로세스 정립 | \`.context/templates/runbook.md\` | \`runbook-제목.md\` |
| 실험/디버깅 중 학습 | \`.context/templates/insight.md\` | \`insight-제목.md\` |

- [ ] 새로 작성한 노트는 고립되지 않도록 반드시 기존 관련 노트나 \`INDEX.md\`와 \`[[wikilink]]\`로 양방향 연결하세요.
- [ ] **지식 정리 및 유지보수 워크플로우:**
  - [ ] **불필요해진 지식 제거**: 더 이상 유효하지 않거나 잘못된 정보가 담긴 과거 노트는 과감히 삭제하거나 상단에 Deprecated 표시를 하여 혼란을 방지하세요.
  - [ ] **중복 노트 합병(Merge)**: 비슷한 주제를 다루는 여러 개의 노트(redundant notes)가 발견되면, 하나의 핵심 노트로 내용을 통합하고 나머지 노트는 삭제하세요.
  - [ ] **연결성 점검**: 지식을 갱신하거나 합병할 때 끊어진 링크(Dead link)가 발생하지 않도록, 이 노트를 참조하던 다른 노트나 \`INDEX.md\`의 링크들도 함께 업데이트하세요.`;

const DEFAULT_SEARCH_GUIDE = `# 노트/스킬 검색 및 읽기 가이드

- [ ] 관련 키워드 검색
- [ ] INDEX.md 확인
- [ ] 관련 노트 탐색`;

const DEFAULT_QUALITY_CHECK_GUIDE = `# 퀄리티 검증 가이드

- [ ] Lint/Format 확인
- [ ] 테스트 실행
- [ ] 빌드 확인
- [ ] 코드 리뷰 요청 및 통과`;

const DEFAULT_SCOPE_REVIEW_GUIDE = `# 작업 경로 리뷰 가이드

- [ ] 현재 작업 범위 확인
- [ ] 스코프 이탈 여부 검토`;

const DEFAULT_COMMIT_GUIDE = `# 체크포인트 커밋 가이드

- [ ] 작업 내용 스테이징
- [ ] 원자적 커밋 메시지 작성`;

const DEFAULT_COMPLETE_GUIDE = `# 작업 완료 가이드

- [ ] 모든 커밋 및 푸시 작업 완료 후 수행하세요.
- [ ] 프로젝트 루트에 \`.context/.work-complete\` 파일을 생성하거나 덮어쓰세요.
- [ ] 파일 내용은 \`.context/templates/work-complete.txt\` 템플릿을 복사하여 작성해야 합니다. (정확히 아래 3줄 형식이어야 합니다):
  timestamp={{currentTimestamp}}
  session_id={{sessionId}}
  turn_id={{turnId}}
- [ ] 이 동작은 작업 완료를 시스템에 알리고 프롬프트 주입 루프를 종료시키는 트리거입니다.`;

const GUIDE_FILES: Record<string, string> = {
  'daily-note-guide.md': DEFAULT_DAILY_NOTE_GUIDE,
  'note-guide.md': DEFAULT_NOTE_GUIDE,
  'search-guide.md': DEFAULT_SEARCH_GUIDE,
  'quality-check.md': DEFAULT_QUALITY_CHECK_GUIDE,
  'scope-review.md': DEFAULT_SCOPE_REVIEW_GUIDE,
  'commit-guide.md': DEFAULT_COMMIT_GUIDE,
  'complete-guide.md': DEFAULT_COMPLETE_GUIDE,
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
  'work-complete.txt': DEFAULT_WORK_COMPLETE_TEMPLATE,
};

export function scaffoldIfNeeded(projectDir: string): boolean {
  const contextDir = join(projectDir, resolveContextDir(projectDir));

  // Idempotency check: if context dir exists, skip scaffolding
  if (existsSync(contextDir)) {
    return false;
  }

  try {
    const templatesDir = join(contextDir, 'templates');
    mkdirSync(templatesDir, { recursive: true });

    const guidesDir = join(contextDir, 'guides');
    mkdirSync(guidesDir, { recursive: true });

    writeFileSync(join(contextDir, 'config.jsonc'), DEFAULT_CONFIG, 'utf-8');

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

  mkdirSync(join(contextDir, 'templates'), { recursive: true });
  mkdirSync(join(contextDir, 'guides'), { recursive: true });

  const filesToUpdate: Record<string, string> = {
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
