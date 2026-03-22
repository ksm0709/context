# Decision: /context-update 커맨드 제거 → CLI 도구로 대체

## 결정

오픈코드 슬래시 커맨드(`/context-update`)를 제거하고, `bunx @ksm0709/context <command>` CLI 도구로 대체.

## 근거

스캐폴드 강제 업데이트는 오픈코드 컨텍스트(session, client)가 전혀 필요 없는 순수 파일시스템 작업.
오픈코드 커맨드로 구현하면:

- `command.execute.before` 훅의 `output.parts` 뮤테이션 제약 → [[docs/gotcha-opencode-command-hook-parts-mutation.md]]
- 오픈코드 없이 실행 불가 (CI, 스크립트에서 사용 불가)
- 플러그인 코드 복잡도 증가 (config 훅 + command 훅)

CLI로 가면 이 모든 제약이 사라지고, 향후 커맨드 추가도 자연스럽게 확장 가능.

## 구현

```
src/cli/
├── index.ts          ← 진입점 (process.argv 파싱, 커맨드 라우팅)
└── commands/
    └── update.ts     ← scaffold 강제 업데이트
```

`package.json`에 `bin` 필드 추가:

```json
"bin": { "context": "./dist/cli/index.js" }
```

사용: `bunx @ksm0709/context update [project-dir]`

## 고려한 대안

- 오픈코드 커맨드 유지: 오픈코드 컨텍스트 불필요한 작업에 과도한 의존 → 탈락
- 둘 다 유지: 중복 유지보수 비용, 일관성 없음 → 탈락

## 관련 노트

- [[docs/architecture.md]] — Scaffold System 섹션
- [[docs/gotcha-opencode-command-hook-parts-mutation.md]] — 커맨드 훅 제약
- [[docs/decision-scaffold-auto-update-scope.md]] — 자동 업데이트 범위 결정
