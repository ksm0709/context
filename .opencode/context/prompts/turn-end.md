<!-- primary-only -->
## 작업 마무리

작업이 완료되면, 아래 두 가지를 **서브에이전트에 위임**하세요.
메인 에이전트가 직접 수행하지 마세요.

### 1. 퀄리티 체크 (서브에이전트 위임)

변경한 코드의 품질을 검증하는 서브에이전트를 실행하세요.

```
task(
  category="quick",
  load_skills=[],
  description="Quality check for changed files",
  prompt="""
  TASK: 변경된 파일들에 대해 퀄리티 체크를 수행하세요.
  EXPECTED OUTCOME: 모든 체크 통과 또는 실패 항목 목록
  REQUIRED TOOLS: Bash (lint, format, test 실행)
  MUST DO:
    - 변경한 코드에 대해 lint 실행
    - 변경한 코드에 대해 formatter 실행 (lint와 별개)
    - 기존 테스트 통과 확인
    - 새로 작성/변경한 코드의 테스트 커버리지 80% 이상 확인
    - 변경 범위 확인: 요청과 무관한 파일을 건드리지 않았는지 검증
    - 실패 항목이 있으면 구체적인 에러 메시지와 파일 위치를 보고
  MUST NOT DO:
    - 코드를 직접 수정하지 마세요 (보고만)
    - 테스트를 삭제하거나 스킵하지 마세요
  CONTEXT: [변경한 파일 목록과 변경 내용 요약을 여기에 포함]
  """
)
```

퀄리티 체크 실패 시: 서브에이전트 보고를 바탕으로 직접 수정한 뒤, 다시 위임하세요.

### 2. 지식 정리 (서브에이전트 위임)

작업 중 기록할 만한 발견이 있었다면, 지식 노트 작성을 서브에이전트에 위임하세요.

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

```
task(
  category="quick",
  load_skills=[],
  description="Write Zettelkasten knowledge note",
  prompt="""
  TASK: 아래 내용을 바탕으로 Zettelkasten 지식 노트를 작성하세요.
  EXPECTED OUTCOME: 템플릿에 맞는 노트 파일 생성, 관련 노트 링크 연결
  REQUIRED TOOLS: Read (템플릿 읽기), Write (노트 작성), Edit (기존 노트 링크 추가)
  MUST DO:
    - 해당 템플릿 파일을 읽고 그 구조에 맞춰 노트 작성
    - 노트 첫 줄: 명확한 제목 (# Title)
    - 핵심 내용을 자기 언어로 간결하게 서술 (복사-붙여넣기 금지)
    - 관련 노트를 [[relative/path/file.md]] 형태의 wikilink로 연결
    - knowledge 디렉토리 (기본: docs/)에 저장. 도메인 폴더가 있다면 적절한 도메인에 저장
    - 기존 노트의 내용이 변경사항과 불일치하면 업데이트
    - 도메인 폴더에 저장했다면 해당 INDEX.md에 항목 추가
  MUST NOT DO:
    - 소스 코드를 수정하지 마세요 (노트만 작성)
    - 노트에 여러 주제를 섞지 마세요 (원자성 원칙)
  CONTEXT: [기록할 발견 내용, 해당하는 템플릿 종류, 관련 기존 노트 목록을 여기에 포함]
  """
)
```

<!-- /primary-only -->
<!-- subagent-only -->
<environment-constraints>
당신은 현재 메인 오케스트레이터가 호출한 **말단 워커(Worker) 에이전트**입니다.
현재 당신의 실행 환경(Sandbox)에서는 네트워크 자원 보호를 위해 **다른 에이전트를 생성, 호출, 위임하는 모든 도구(예: task, background_task 등)의 권한이 시스템 레벨에서 회수**되었습니다.

만약 작업 중 다른 전문가(explore, librarian 등)의 도움이 필요하다면, 직접 에이전트를 부르려 시도하지 마세요. 대신 현재까지의 분석 결과를 요약하고 "OOO 에이전트의 도움이 필요함"이라는 메시지와 함께 작업을 종료(Complete)하여 메인 에이전트에게 제어권을 반환하세요.
</environment-constraints>
<!-- /subagent-only -->
