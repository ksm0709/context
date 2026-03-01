# Gotcha: opencode 1.2.15 -- `opencode run`이 Session not found로 크래시

## 예상 vs 실제

**예상**: `opencode run "message"` 실행 시 새 세션이 생성되고 에이전트가 메시지를 처리.

**실제**: 플러그인 로딩·scaffold 생성까지 정상 완료 후, 세션 생성 단계에서 `Session not found` 에러로 크래시. 모든 프로젝트 디렉토리에서 동일하게 재현되며 플러그인 유무와 무관.

```
INFO  service=context Scaffold created at .opencode/context/   ← 플러그인 정상
ERROR service=server error= failed
Error: Session not found                                        ← opencode 내부 실패
```

## 우회법

`opencode run`을 검증 수단으로 사용하지 않는다. 대신:

1. **bun 직접 로드** — 플러그인을 import해서 mock input으로 호출:
   ```typescript
   import plugin from './dist/index.js';
   const hooks = await plugin({ directory: tmpDir, client: mockClient });
   ```
2. **TUI 모드** — `opencode` (인자 없이)로 TUI를 열어 수동 확인.
3. **유닛 테스트** — `bun test`로 scaffold/hook 동작 검증.

## 원인 (알려진 경우)

opencode 1.2.15의 `run` 서브커맨드에서 내부 서버 시작 후 세션을 생성하는 과정에서 타이밍 이슈 또는 API 호출 실패가 발생하는 것으로 추정. DB 마이그레이션은 정상 완료되나 그 이후 세션 생성 API가 실패한다.

검증 환경: Linux, opencode 1.2.15 (2026-02-27 기준 최신).

## 관련

- opencode 버전: 1.2.15 (`opencode upgrade` 시 "already installed" 반환)
- [[docs/architecture.md]] — 플러그인 진입점과 scaffold 흐름
