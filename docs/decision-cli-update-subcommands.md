# Decision: CLI update 커맨드 서브커맨드 체계 도입

## 결정

`context update` 단일 커맨드를 3개 서브커맨드로 확장: `all`(기본), `prompt`, `plugin`.

## 근거

단일 `update` 커맨드는 모든 상황을 커버하기 어려웠음:

- **all**: 12개 파일 전체 강제 업데이트 — 사용자가 명시적으로 전체 동기화를 원할 때
- **prompt**: prompts 2개 파일만 업데이트 — config/templates는 보존하면서 프롬프트만 최신화
- **plugin**: 패키지 자체 업데이트 — lockfile 기반 패키지 매니저 자동 감지 후 self-update

하위 호환성 유지: 기존 `context update /path`는 `context update all /path`로 해석.

Bun.spawnSync으로 패키지 매니저 호출 — Bun 타겟 프로젝트이므로 자연스러운 선택. COMMANDS 객체 대신 printHelp에서 직접 help 텍스트 작성 — 서브커맨드 표현의 유연성 확보.

## 고려한 대안

- 단일 커맨드에 플래그 추가 (`--prompt-only`, `--plugin`): 명령어가 길어지고 직관성 저하 → 탈락
- 별도 커맨드로 분리 (`context update-prompt`, `context update-plugin`): discoverability 저하, 일관성 없음 → 탈락
- npm/pnpm/yarn 하드코딩: 프로젝트별 패키지 매니저가 다르므로 lockfile 기반 자동 감지가 유연함 → 탈락

## 관련 노트

- [[docs/decision-cli-tool-over-opencode-command.md]] — CLI 도구 대체 결정 (상위 결정)
- [[docs/decision-scaffold-auto-update-scope.md]] — 자동 업데이트 범위 결정
- [[docs/architecture.md]] — CLI System 섹션
