# Gotcha: Bun -- 글로벌 CLI 버전 불일치

## 예상 vs 실제

**예상**: `bun install`로 최신 버전(0.0.12)을 설치하면 `context` 명령어도 최신 버전을 출력함.

**실제**: 터미널에서 `context --version`을 실행하면 여전히 구버전(0.0.11)이 표시됨.

```bash
$ bun install  # package.json에 0.0.12 설치됨
$ context --version
0.0.11  # ← 왜 구버전?
```

## 우회법

글로벌 패키지를 별도로 업데이트:

```bash
bun install -g @ksm0709/context
```

또는 글로벌 바이너리를 제거하고 로컬 버전 사용:

```bash
# 글로벌 바이너리 제거
rm ~/.bun/bin/context

# 이제 로컬 node_modules의 버전 사용
./node_modules/.bin/context --version
```

## 원인 (알려진 경우)

`context` 명령어는 `$PATH`에서 먼저 찾은 실행 파일을 사용함. Bun은 글로벌 설치 시 `~/.bun/bin/`에 바이너리를 생성하고, 이 경로가 보통 `$PATH`에서 우선순위를 가짐.

로컬 프로젝트의 `node_modules`와 글로벌 `~/.bun/bin/`은 별개의 공간. `bun install`은 현재 프로젝트만 업데이트하고, 글로벌 바이너리는 `-g` 플래그 없이는 건드리지 않음.

## 예방

릴리즈 후 글로벌 패키지도 함께 업데이트:

```bash
# 릴리즈 체크리스트
npm publish
bun install -g @ksm0709/context
```

또는 `package.json` 스크립트에 추가:

```json
{
  "scripts": {
    "postpublish": "bun install -g @ksm0709/context"
  }
}
```

## 관련

- Bun 글로벌 패키지 경로: `~/.bun/bin/`
- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] -- OpenCode 캐시 버전 불일치 (유사한 버전 문제)
