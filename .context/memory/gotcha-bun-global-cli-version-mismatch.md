# Gotcha: Bun -- 글로벌 CLI 버전 불일치

## 예상 vs 실제

**예상**: `bun install`로 최신 버전(0.0.12)을 설치하면 `context` 명령어도 최신 버전을 출력함.

**실제**: 터미널에서 `context --version`을 실행하면 여전히 구버전(0.0.11)이 표시됨.

```bash
$ bun install  # package.json에 0.0.12 설치됨
$ context --version
0.0.11  # ← 왜 구버전?
```

## 우회법 (자동화됨)

**자동 해결**: `context update plugin` 커맨드가 이제 글로벌 설치를 자동 감지하여 우선 업데이트합니다. `~/.bun/bin/context` 존재 여부를 확인하고, 있으면 `bun install -g @ksm0709/context@{version}`으로 글로벌을 먼저 업데이트한 뒤 로컬을 업데이트합니다.

```bash
# 이제 자동으로 글로벌 + 로컬 모두 업데이트됨
context update plugin
```

**수동 우회법** (자동 해결이 안 될 때만 사용):

```bash
# 글로벌 패키지를 별도로 업데이트
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

`context update plugin`을 사용하면 글로벌과 로컬을 함께 업데이트하므로 별도 글로벌 업데이트가 불필요합니다. 릴리즈 후에는 단순히:

```bash
context update plugin
```

또는 CI/CD에서 자동화:

```yaml
# GitHub Actions 예시
- run: npx @ksm0709/context update plugin
```

## 관련

- Bun 글로벌 패키지 경로: `~/.bun/bin/`
- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] -- OpenCode 캐시 버전 불일치 (유사한 버전 문제)
- [[docs/decision-cli-update-subcommands.md]] -- CLI update 서브커맨드 체계
- [[docs/architecture.md]] -- CLI System 섹션 (자동 감지 로직)
