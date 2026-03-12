## 작업 마무리

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
| 아키텍처/기술 스택 중대 결정    | [ADR](.opencode/context/templates/adr.md)           | `adr-NNN-제목.md`           |
| 반복 사용할 코드 패턴 발견      | [Pattern](.opencode/context/templates/pattern.md)   | `pattern-제목.md`           |
| 비자명한 버그 해결              | [Bug](.opencode/context/templates/bug.md)           | `bug-제목.md`               |
| 외부 API/라이브러리 예상외 동작 | [Gotcha](.opencode/context/templates/gotcha.md)     | `gotcha-라이브러리-제목.md` |
| 작은 기술적 선택                | [Decision](.opencode/context/templates/decision.md) | `decision-제목.md`          |
| 모듈/프로젝트 개요 필요         | [Context](.opencode/context/templates/context.md)   | `context-제목.md`           |
| 반복 가능한 프로세스 정립       | [Runbook](.opencode/context/templates/runbook.md)   | `runbook-제목.md`           |
| 실험/디버깅 중 학습             | [Insight](.opencode/context/templates/insight.md)   | `insight-제목.md`           |

해당 사항이 없으면 이 단계는 건너뛰세요.

- 관련 템플릿 파일을 읽고 그 구조에 맞춰 내용을 정리하세요
- 노트 첫 줄은 명확한 제목(`# Title`)으로 시작하세요
- 핵심 내용을 자기 언어로 간결하게 서술하고, 관련 노트는 `[[relative/path/file.md]]` 형태로 연결하세요
- knowledge 디렉토리(기본: `docs/`) 또는 적절한 도메인 폴더에 저장하고, 필요한 경우 기존 INDEX.md나 관련 노트를 함께 갱신하세요

기존 설치의 사용자 프롬프트 파일은 자동으로 바뀌지 않습니다. 새 기본 프롬프트가 필요하면 `context update prompt`로 명시적으로 새로고침하세요.
