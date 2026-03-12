# Decision: 스캐폴드 자동 업데이트 시 templates만 갱신

## 결정

플러그인 버전이 변경되면 `templates/*.md`만 자동 업데이트. `config.jsonc`와 `prompts/`는 자동 업데이트에서 제외.
기존 설치에서 새 기본 프롬프트를 반영하려면 사용자가 `context update prompt`를 명시적으로 실행해야 한다.

## 근거

- `config.jsonc`: 사용자가 knowledge dir, sources 등을 커스터마이징하는 설정 파일. 덮어쓰면 사용자 설정 손실.
- `prompts/turn-start.md`, `prompts/turn-end.md`: 사용자가 프로젝트에 맞게 프롬프트를 수정할 수 있음. 덮어쓰면 커스터마이징 손실. 따라서 기존 설치는 자동 마이그레이션하지 않고, 필요 시 `context update prompt`로 의도적으로 새로고침한다.
- `templates/*.md`: 노트 작성 가이드로, 플러그인이 개선하는 내용. 사용자가 직접 수정할 동기가 낮음.

수동 `/context-update` 커맨드는 기존대로 12개 파일 전부 업데이트 (사용자의 명시적 의도).

## 고려한 대안

- 전부 자동 업데이트: 사용자 커스터마이징 손실 위험 → 탈락
- templates + prompts 업데이트: prompts도 사용자가 수정할 수 있어 위험 → 탈락
- 업데이트 안 함 (수동만): 대부분의 사용자가 `/context-update`를 모르거나 잊음 → 탈락

## 관련 노트

- [[docs/architecture.md]] — Scaffold System 섹션
- [[docs/adr-001-zettelkasten-hook-templates.md]] — 템플릿 설계 결정
