# Gotcha: OpenCode -- 플러그인 캐시 버전 불일치

## 예상 vs 실제

**예상**: npm에 `@ksm0709/context@0.0.6`을 퍼블리시하면 OpenCode가 자동으로 최신 버전을 사용함.

**실제**: OpenCode는 `~/.cache/opencode/node_modules/`에 플러그인을 캐싱하며, 캐시된 버전(0.0.3)을 계속 사용하여 최신 기능/버그 수정이 반영되지 않음.

로그 증상:

```
WARN service=bun pkg=@ksm0709/context cachedVersion=0.0.3
Failed to resolve latest version, using cached

ERROR service=plugin path=/home/taeho/.cache/opencode/node_modules/@ksm0709/context
error=ResolveMessage: Cannot find module '...' failed to load plugin
```

## 우회법

캐시된 플러그인 디렉토리를 수동으로 삭제:

```bash
# 1. ~/.cache 쪽 삭제 (의존성 리졸브 관련)
rm -rf ~/.cache/opencode/node_modules/@ksm0709/context

# 2. ~/.config 쪽 삭제 (실제로 로딩되는 fallback 파일 관련 - 가장 확실한 해결책)
rm -rf ~/.config/opencode/node_modules/@ksm0709/context
```

그 후 OpenCode를 **완전히 종료하고 재시작**.

> **💡 핵심:** OpenCode는 `opencode.json`에 기재된 패키지를 런타임에 알아서 관리하므로, `~/.config/opencode` 디렉토리 아래에 수동으로 설치하는 것은 권장되지 않습니다. 이 폴더에 남아있는 구버전 플러그인이 문제를 일으키는 가장 큰 원흉이므로, 이 폴더를 완전히 날려버리는 것이 가장 확실한 해결책입니다.

## 원인 (알려진 경우)

OpenCode의 Bun 기반 플러그인 로더는 npm 패키지를 로컬 캐시에 저장. 캐시 무효화 로직이 예상보다 보수적일 수 있음. 특히 major/minor 버전 변경 없이 patch만 올라갈 때(0.0.3 → 0.0.6) 캐시 갱신이 트리거되지 않을 수 있음.

## 예방

릴리즈 후 수동으로 캐시 클리어:

```bash
# 릴리즈 체크리스트
npm publish
rm -rf ~/.cache/opencode/node_modules/@ksm0709/context
rm -rf ~/.config/opencode/node_modules/@ksm0709/context
```

또는 사용자에게 캐시 클리어 안내 포함:

> "0.0.6 업데이트 후 플러그인이 로드되지 않으면 `rm -rf ~/.config/opencode/node_modules/@ksm0709/context` 후 OpenCode 재시작"

## 관련

- OpenCode 캐시 경로: `~/.cache/opencode/node_modules/`
- [[docs/gotcha-opencode-status-plugin-name-dist.md]] -- file:// fallback 발생 시 /status에서 "dist" 표시됨
- [[docs/gotcha-opencode-command-hook-parts-mutation.md]] -- 또 다른 OpenCode 함정
- [[docs/gotcha-opencode-run-session-not-found.md]] -- opencode run 크래시
- [[docs/runbook-context-plugin-release.md]] -- 플러그인 수동 갱신 방법
