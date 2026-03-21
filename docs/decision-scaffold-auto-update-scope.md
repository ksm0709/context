# Decision: 스캐폴드 자동 업데이트 시 templates, prompts, guides 갱신

## 결정

플러그인 버전이 변경되면 `templates/*.md`, `prompts/*.md`, `guides/*.md`를 자동 업데이트한다. `config.jsonc`는 자동 업데이트에서 제외하여 사용자 설정을 보호한다.

## 근거

- `config.jsonc`: 사용자가 knowledge dir, sources 등을 커스터마이징하는 설정 파일. 덮어쓰면 사용자 설정 손실이 발생하므로 자동 업데이트에서 제외.
- `prompts/`, `guides/`: 플러그인 업데이트를 통해 제공되는 최신 기본값(메뉴, 가이드 등)을 사용자가 즉시 활용할 수 있도록 자동 업데이트 대상에 포함.
- 사용자 커스터마이징 보호: 사용자가 직접 수정한 설정(config)은 유지하되, 플러그인이 제공하는 기능적 가이드와 프롬프트는 최신 상태로 유지하여 사용자 경험을 개선.

## 고려한 대안

- config까지 자동 업데이트: 사용자 설정 손실 위험 → 탈락.
- prompts/guides 수동 유지: 최신 기능/가이드 전파 지연 → 탈락.

## 관련 노트

- [[docs/architecture.md]] — Scaffold System 섹션
- [[docs/adr-001-zettelkasten-hook-templates.md]] — 템플릿 설계 결정
