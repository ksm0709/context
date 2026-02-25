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
    "sources": ["AGENTS.md"]
  }
}`;

const DEFAULT_TURN_START = `## Knowledge Context

이 프로젝트의 지식 베이스를 참고하여 작업하세요.
- 작업과 관련된 지식 파일이 있으면 먼저 읽고 참조하세요
- 지식 간 [[링크]]를 따라가며 관련 컨텍스트를 파악하세요
- AGENTS.md의 지시사항을 준수하세요
`;

const DEFAULT_TURN_END = `## 작업 마무리 체크리스트

작업을 완료하기 전에 반드시:

### 퀄리티 보장
- [ ] 변경한 코드에 대해 lint 실행
- [ ] 타입 에러 확인
- [ ] 기존 테스트 통과 확인

### 지식 정리
- [ ] 새로 알게 된 중요한 패턴/결정이 있으면 지식 파일로 정리
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
