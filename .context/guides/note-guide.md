# 지식 노트 작성 및 관리 가이드

- [ ] **노트 생성**: `context_mcp_create_knowledge_note` 도구를 사용하여 생성하세요.
- [ ] 템플릿 모드에서는 먼저 `.context/templates/<template>.md`를 읽고, **완성된 markdown 전체**를 `content`로 전달하세요.
- [ ] 템플릿 모드에서는 `tags`/`linked_notes`를 따로 넘기지 마세요. 관련 노트와 메타데이터는 markdown 본문에 직접 작성해야 합니다.
- [ ] 제텔카스텐(Zettelkasten) 3대 원칙 준수:
  - [ ] 원자성: 한 노트당 한 주제
  - [ ] 연결: 고립된 노트 방지
  - [ ] 자기 언어 서술: 핵심을 이해하고 간결하게 서술
- [ ] **기록 대상 판단 기준:**

| 상황 | 템플릿 | 파일명 패턴 |
| --- | --- | --- |
| 아키텍처/기술 스택 중대 결정 | `.context/templates/adr.md` | `adr-NNN-제목.md` |
| 반복 사용할 코드 패턴 발견 | `.context/templates/pattern.md` | `pattern-제목.md` |
| 비자명한 버그 해결 | `.context/templates/bug.md` | `bug-제목.md` |
| 외부 API/라이브러리 예상외 동작 | `.context/templates/gotcha.md` | `gotcha-라이브러리-제목.md` |
| 작은 기술적 선택 | `.context/templates/decision.md` | `decision-제목.md` |
| 모듈/프로젝트 개요 필요 | `.context/templates/context.md` | `context-제목.md` |
| 반복 가능한 프로세스 정립 | `.context/templates/runbook.md` | `runbook-제목.md` |
| 실험/디버깅 중 학습 | `.context/templates/insight.md` | `insight-제목.md` |

- [ ] 새로 작성한 노트는 고립되지 않도록 반드시 기존 관련 노트나 `INDEX.md`와 `[[wikilink]]`로 양방향 연결하세요.
- [ ] **지식 정리 및 유지보수 워크플로우:**
  - [ ] **불필요해진 지식 제거**: 더 이상 유효하지 않거나 잘못된 정보가 담긴 과거 노트는 과감히 삭제하거나 상단에 Deprecated 표시를 하여 혼란을 방지하세요.
  - [ ] **중복 노트 합병(Merge)**: 비슷한 주제를 다루는 여러 개의 노트(redundant notes)가 발견되면, 하나의 핵심 노트로 내용을 통합하고 나머지 노트는 삭제하세요.
  - [ ] **연결성 점검**: 지식을 갱신하거나 합병할 때 끊어진 링크(Dead link)가 발생하지 않도록, 이 노트를 참조하던 다른 노트나 `INDEX.md`의 링크들도 함께 업데이트하세요.