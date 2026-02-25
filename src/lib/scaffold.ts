import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '../constants';

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

이 프로젝트는 지식 베이스를 유지하여 작업 간 컨텍스트를 보존합니다.

### 작업 전 필수
- 아래 **Available Knowledge** 목록에서 현재 작업과 관련된 문서를 먼저 읽으세요
- 지식 파일에 기록된 아키텍처 결정, 패턴, 제약사항을 반드시 따르세요
- 문서 내 [[링크]]를 따라가며 관련 컨텍스트를 확장하세요

### 우선순위
- AGENTS.md의 지시사항이 항상 최우선
- 지식 파일의 결정사항 > 일반적 관행
- 지식 파일에 없는 새로운 결정은 작업 완료 시 기록하세요
`;

const DEFAULT_TURN_END = `## 작업 마무리 체크리스트

작업을 완료하기 전에 반드시:

### 퀄리티 보장
- [ ] 변경한 코드에 대해 lint 실행
- [ ] 타입 에러 확인
- [ ] 기존 테스트 통과 확인

### 지식 정리
- [ ] 새로 알게 된 중요한 패턴/결정이 있으면 지식 파일로 정리
- [ ] 기존 지식 파일의 내용이 변경사항과 불일치하면 업데이트
- [ ] 새 지식 파일 작성 시: 첫 줄에 제목(# Title), 핵심 내용 간결하게
`;

export function scaffoldIfNeeded(projectDir: string): boolean {
  const contextDir = join(projectDir, '.opencode', 'context');

  // Idempotency check: if context dir exists, skip scaffolding
  if (existsSync(contextDir)) {
    return false;
  }

  try {
    const promptsDir = join(contextDir, 'prompts');
    mkdirSync(promptsDir, { recursive: true });

    writeFileSync(join(contextDir, 'config.jsonc'), DEFAULT_CONFIG, 'utf-8');
    writeFileSync(join(promptsDir, DEFAULTS.turnStartFile), DEFAULT_TURN_START, 'utf-8');
    writeFileSync(join(promptsDir, DEFAULTS.turnEndFile), DEFAULT_TURN_END, 'utf-8');

    return true;
  } catch {
    return false;
  }
}
