# Runbook: @ksm0709/context 릴리즈 후 캐시 동기화

## 목적

npm 퍼블리시 후 OpenCode가 최신 플러그인 코드를 로딩하도록 3중 캐시를 동기화.

## 배경

OpenCode는 `@latest` 지정에도 `~/.cache/opencode/bun.lock`에 고정된 버전을 우선 사용.
npm resolve 실패 시 `~/.config/opencode/node_modules/`로 fallback — 이 경로는 자동 업데이트 안 됨.
→ 결과: 플러그인 로딩은 성공하지만 **구버전 코드** 실행 (에러 없음, 로그에서 식별 어려움).

[[docs/insight-opencode-plugin-loading-debugging.md]] 참조.

## 사전 조건

- 새 버전이 `npm publish` 완료된 상태
- `package.json`의 `version` 필드가 올바르게 업데이트됨

## 단계

### 1. 빌드

```bash
bun build ./src/index.ts --outdir dist --target bun
```

### 2. fallback 경로 dist 업데이트

```bash
cp -r dist/* ~/.config/opencode/node_modules/@ksm0709/context/dist/
```

### 3. fallback 경로 package.json 버전 수정

```bash
# NEW_VERSION을 실제 버전으로 교체 (예: 0.0.7)
NEW_VERSION=$(node -p "require('./package.json').version")

python3 -c "
import json
path = '$HOME/.config/opencode/node_modules/@ksm0709/context/package.json'
with open(path) as f:
    d = json.load(f)
d['version'] = '$NEW_VERSION'
with open(path, 'w') as f:
    json.dump(d, f, indent=2)
print('Updated to:', d['version'])
"
```

### 4. 캐시 lock 파일 버전 업데이트

`~/.cache/opencode/package.json`:

```json
"@ksm0709/context": "NEW_VERSION"
```

`~/.cache/opencode/bun.lock` (두 곳):

```
"@ksm0709/context": "NEW_VERSION"          ← workspaces.dependencies
"@ksm0709/context": ["@ksm0709/context@NEW_VERSION", ...]   ← packages
```

> bun.lock의 sha512 해시는 그대로 둬도 무방 (OpenCode가 해시 검증을 엄격히 하지 않음)

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
