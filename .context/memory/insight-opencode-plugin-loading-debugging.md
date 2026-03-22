# Insight: OpenCode 플러그인 로딩 디버깅 (완결)

## 발견

OpenCode 플러그인이 최신 코드로 동작하지 않는 문제 — 로그에서 `loading plugin` 이후 성공 메시지 없음.

## 배경

`@ksm0709/context@latest`로 등록했는데 실제로는 오래된 dist 코드가 실행 중이었음. 로그에 에러는 없어서 "로딩 실패"처럼 보였지만 실제로는 **구버전이 정상 로딩**된 상태.

## 디버깅 과정

1. **로그 확인**: `~/.local/share/opencode/log/` 최신 파일에서 context 관련 항목 필터링

   ```
   INFO  service=plugin path=file:///home/taeho/.config/opencode/node_modules/@ksm0709/context/dist/index.js loading plugin
   ```

   → `@latest`인데 왜 `file://` 경로를 쓰는가? 그리고 성공 로그가 없음.

2. **캐시 lock 파일 발견**: `~/.cache/opencode/bun.lock` 및 `~/.cache/opencode/package.json`에 `"@ksm0709/context": "0.0.3"`이 고정됨
   - OpenCode가 `@latest`를 `0.0.3`으로 resolve 시도 → npm 실패 → `~/.config/opencode/node_modules/@ksm0709/context/`로 fallback
   - 해당 fallback 경로는 버전 **0.0.5** (소스는 0.0.6)

3. **실제 동작 확인**: `bun run`으로 fallback dist 직접 실행 → 에러 없이 정상 동작
   - 즉, 플러그인은 실제로 동작 중이었고, 단지 **구버전**이 실행된 것
   - 성공 로그가 없는 것은 context 플러그인 자체가 init 시 log를 출력하는 조건이 `scaffoldIfNeeded`나 `autoUpdateTemplates` 결과에 따라 달라지기 때문

## 원인 (확정)

OpenCode의 플러그인 로딩 체계:

1. `~/.cache/opencode/package.json` + `bun.lock`에 버전이 고정됨
2. `@latest`를 지정해도 캐시된 버전을 사용하고, npm resolve 실패 시 `~/.config/opencode/node_modules/`로 fallback
3. fallback 경로는 이전에 수동 설치된 버전이 그대로 남아있음

## 해결 (완료)

**수동 캐시 lock 업데이트**:

```bash
# 1. 새 dist 빌드
bun build ./src/index.ts --outdir dist --target bun

# 2. 캐시 및 fallback 경로에 있는 기존 플러그인 폴더 완전 삭제
rm -rf ~/.cache/opencode/node_modules/@ksm0709/context
rm -rf ~/.config/opencode/node_modules/@ksm0709/context

# 3. fallback 경로 재생성 및 최신 dist/package.json 복사
mkdir -p ~/.config/opencode/node_modules/@ksm0709/context
cp -r dist ~/.config/opencode/node_modules/@ksm0709/context/
cp package.json ~/.config/opencode/node_modules/@ksm0709/context/

# 4. 캐시 lock 무효화 및 재설치
cd ~/.cache/opencode && rm -f bun.lock && bun install

## 학습

1. OpenCode 플러그인 로그에서 `loading plugin` 이후 성공 메시지 없음 ≠ 로딩 실패. 구버전 동작일 수 있음
2. `~/.cache/opencode/bun.lock`이 실질적인 버전 결정권을 가짐 — 여기가 고정되면 `@latest`가 무의미
3. npm resolve 실패 시 `~/.config/opencode/node_modules/`로 fallback — 이 경로는 자동 업데이트 안 됨
4. 릴리즈 후 반드시 캐시 lock + fallback dist 동기화 필요 (→ [[docs/runbook-context-plugin-release.md]])

## 관련

- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] -- 캐시 버전 불일치 원인
- [[docs/gotcha-opencode-command-hook-parts-mutation.md]] -- 커맨드 훅 함정
- [[docs/runbook-context-plugin-release.md]] -- 릴리즈 후 캐시 동기화 절차
- [[docs/gotcha-opencode-run-session-not-found.md]] -- opencode run 크래시

## 최신 발견 (2026-03-12)

1. **로딩 경로**: 캐시 정리 후 OpenCode는 `file:///home/bear1130/.config/opencode/node_modules/@ksm0709/context/dist/index.js`에서 플러그인을 로드함.
2. **캐시 상태**: `~/.cache/opencode/package.json`은 플러그인 디렉토리 삭제 후에도 여전히 구버전(0.0.8)으로 고정되어 있어, 캐시 매니페스트가 stale 상태로 남을 수 있음 (참고: [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]]).
3. **재현 패턴**: 설치된 플러그인 빌드를 import하고 `client.session.get`이 에러를 반환하도록 강제하면, `'Failed to detect subagent session; falling back to primary handling.'` 경고 로그가 발생하며 primary-only 프롬프트 내용이 보존됨.
4. **주의**: `opencode run`은 여전히 [[docs/gotcha-opencode-run-session-not-found.md]] 이슈로 인해 사용을 피해야 함.
```
