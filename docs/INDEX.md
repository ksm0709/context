# Knowledge Index

## Decisions

- [[docs/decision-remove-version-ts.md]] — src/version.ts 제거 → package.json에서 직접 읽기
- [[docs/decision-cli-tool-over-opencode-command.md]] — /context-update 커맨드 제거 → CLI 도구로 대체
- [[docs/decision-cli-update-subcommands.md]] — CLI update 커맨드 서브커맨드 체계 도입
- [[docs/decision-scaffold-auto-update-scope.md]] — 스캐폴드 자동 업데이트 시 templates만 갱신
- [[docs/decision-remove-subagent-delegation.md]] — Decision: Remove Subagent Delegation from Prompt Flow

## Gotchas

- [[docs/gotcha-bun-global-reference-error.md]] — Bun -- 테스트 환경에서 전역 객체 Bun 직접 참조 시 ReferenceError

- [[docs/gotcha-bun-vitest-esm-spy-error.md]] — Vitest -- ESM 모듈의 함수 모킹 시 Module namespace 에러

- [[docs/gotcha-bun-test-vitest-api-incompatibility.md]] — Bun -- bun test로 Vitest 전용 API 실행 시 TypeError
- [[docs/gotcha-bun-vitest-global-reference-error.md]] — Bun -- Vitest 환경에서 Bun 전역 객체 직접 참조 시 ReferenceError
- [[docs/gotcha-bun-html-comment-template-literal.md]] — Bun -- TypeScript 템플릿 리터럴 내 HTML 주석 파싱 버그
- [[docs/gotcha-bun-cli-node-reference-error.md]] — Bun CLI -- node로 실행 시 "Bun is not defined" 레퍼런스 에러
- [[docs/gotcha-bun-global-cli-version-mismatch.md]] — Bun -- 글로벌 CLI 버전 불일치
- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] — OpenCode -- 플러그인 캐시 버전 불일치
- [[docs/gotcha-opencode-command-hook-parts-mutation.md]] — @opencode-ai/plugin -- command.execute.before에서 output.parts 재할당 무시됨
- [[docs/gotcha-opencode-status-plugin-name-dist.md]] — OpenCode -- /status에서 플러그인 이름이 "dist"로 표시됨
- [[docs/gotcha-opencode-run-session-not-found.md]] — opencode 1.2.15 -- opencode run이 Session not found로 크래시
- [[docs/gotcha-eslint-no-unused-vars-function-type-params.md]] — eslint -- no-unused-vars가 함수 타입 파라미터명을 unused로 잡음
- [[docs/gotcha-github-actions-manual-tag-publish.md]] — GitHub Actions -- 수동 태그 푸시 후 npm 자동 배포 안 됨
- [[docs/gotcha-npm-unpublish-dependent-packages.md]] — npm -- unpublish 차단 (dependent packages)

## Patterns

- [[docs/pattern-bun-vitest-esm-mocking.md]] — Bun/Vitest ESM Mocking

- [[docs/pattern-d8-prompt-markers.md]] — D8 Prompt Markers

## Architecture

- [[docs/architecture.md]] — Plugin Architecture
- [[docs/adr-001-zettelkasten-hook-templates.md]] — 제텔카스텐 훅 콘텐츠 + 8개 개별 노트 템플릿
- [[docs/adr-002-domain-index-knowledge-structure.md]] — 도메인 폴더 + INDEX.md 기반 지식 구조

## Bugs

- [[docs/bug-knowledge-index-spatial-mismatch.md]] — knowledge index가 turn-start와 다른 위치에 주입되어 공간적 참조 깨짐
- [[docs/bug-update-plugin-npm-global-not-detected.md]] — context update plugin이 npm/nvm 글로벌 설치를 감지·갱신하지 못함

## Insights

- [[docs/insight-opencode-plugin-loading-debugging.md]] — OpenCode 플러그인 로딩 디버깅 (완결)
- [[docs/synthetic-message-injection.md]] — Synthetic 메시지 주입의 한계와 대안

## Runbooks

- [[docs/runbook-context-plugin-release.md]] — @ksm0709/context 릴리즈 후 캐시 동기화
- [[docs/runbook-github-actions-trusted-publishing.md]] — GitHub Actions Trusted Publishing 설정 및 활용
- [[docs/gotcha-bun-vitest-mocking.md]]
- [[docs/decision-update-test-mocking.md]]
