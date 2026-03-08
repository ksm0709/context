# Runbook: @ksm0709/context 릴리즈 후 캐시 동기화

## 목적

npm 퍼블리시 후 OpenCode가 최신 플러그인 코드를 로딩하도록 3중 캐시를 동기화.

## 배경

OpenCode는 `@latest` 지정에도 `~/.cache/opencode/bun.lock`에 고정된 버전을 우선 사용.
npm resolve 실패 시 `~/.config/opencode/node_modules/`로 fallback — 이 경로는 자동 업데이트 안 됨.
→ 결과: 플러그인 로딩은 성공하지만 **구버전 코드** 실행 (에러 없음, 로그에서 식별 어려움).

[[docs/insight-opencode-plugin-loading-debugging.md]] 참조.

> **참고**: OpenCode의 플러그인 로딩 메커니즘은 `opencode.json`에 기재된 패키지명(`@ksm0709/context@latest`)을 바탕으로 OpenCode가 런타임에 직접 `~/.cache/opencode` 환경에서 설치 및 관리를 수행합니다. 따라서 사용자가 `~/.config/opencode` 폴더 안에 직접 패키지를 설치하는 것은 의도된 사용법이 아닙니다. 이 경로에 구버전이 남아있으면 OpenCode의 fallback 로직이 이를 참조하여 오작동(버전 불일치)을 일으키게 됩니다.

## 사전 조건

- 새 버전이 `npm publish` 완료된 상태
- `package.json`의 `version` 필드가 올바르게 업데이트됨

## 단계

### 1. 빌드

```bash
bun build ./src/index.ts --outdir dist --target bun
```

### 2. fallback 경로 등 구버전 잔재 완전 삭제 (가장 중요)

```bash
# OpenCode가 fallback으로 참조할 수 있는 구버전 잔재를 모두 삭제
rm -rf ~/.config/opencode/node_modules/@ksm0709/context
rm -rf ~/.cache/opencode/node_modules/@ksm0709/context
```

> **💡 중요**: `~/.config/...` 폴더에 남아있는 구버전 플러그인이 문제를 일으키는 가장 큰 원인입니다. `opencode.json`만으로 관리되어야 하므로 이 폴더를 완전히 날려버려야 합니다.

### 3. 캐시 lock 파일 무효화 및 재설치

```bash
cd ~/.cache/opencode && rm -f bun.lock && bun install
```

### 5. OpenCode 재시작

완전히 종료 후 재시작.

## 확인 방법

최신 로그에서 context 플러그인 로딩 확인:

```bash
LOG=$(ls -t ~/.local/share/opencode/log/*.log | head -1)
grep "context\|ksm" "$LOG" | grep -v "permission\|ruleset\|cwd="
```

정상 로딩 시:

```
INFO  service=plugin path=@ksm0709/context@latest loading plugin
INFO  service=context ...  ← scaffolding 또는 auto-update 메시지
```

## 문제 해결

| 증상                                   | 해결                                                      |
| -------------------------------------- | --------------------------------------------------------- |
| `loading plugin` 후 성공 메시지 없음   | 구버전 동작 중일 수 있음. dist와 package.json 버전 재확인 |
| npm resolve WARN (cachedVersion=X.X.X) | 정상 — fallback 경로가 최신이면 문제 없음                 |
| 플러그인 hooks가 비어있음              | dist/index.js export default 확인                         |

## 관련 노트

- [[docs/insight-opencode-plugin-loading-debugging.md]] -- 근본 원인 분석
- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] -- 캐시 버전 불일치 패턴
