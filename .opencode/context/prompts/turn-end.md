## 작업 마무리 체크리스트

작업을 완료하기 전에 반드시:

### 퀄리티 보장

- [ ] 변경한 코드에 대해 lint 실행
- [ ] 타입 에러 확인
- [ ] 기존 테스트 통과 확인

### 지식 정리 (Zettelkasten)

아래 상황에 해당하면, 해당 템플릿 파일을 읽고 그 구조에 맞춰 노트를 작성하세요.

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

- [ ] 위 상황에 해당하는 발견이 있었다면 노트를 작성했는가?
- [ ] 관련 기존 노트에 [[링크]]를 추가했는가?
- [ ] 기존 노트의 내용이 변경사항과 불일치하면 업데이트했는가?

#### 노트 작성 규칙

- 첫 줄: 명확한 제목 (`# Title`)
- 핵심 내용을 자신의 언어로 간결하게 서술
- 관련 노트를 `[[relative/path/file.md]]` 형태의 wikilink로 연결
- knowledge 디렉토리 (기본: `docs/`)에 저장
