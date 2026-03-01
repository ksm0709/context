# Insight: OpenCode 플러그인 로딩 디버깅

## 발견

OpenCode 플러그인 업데이트 후 "/status"에서 플러그인이 "dist"로 표시되는 현상.

## 배경

`@ksm0709/context@0.0.6`을 npm에 퍼블리시하고, 캐시 클리어 후에도 OpenCode가 플러그인을 "dist"라는 이름으로 인식함.

## 디버깅 과정

1. **초기 증상**: OpenCode 로그에서 플러그인 로드 실패

   ```
   ERROR service=plugin path=.../node_modules/@ksm0709/context
   error=ResolveMessage: Cannot find module '...' failed to load plugin
   ```

2. **캐시 클리어**: `~/.cache/opencode/node_modules/@ksm0709/context` 삭제
   - 삭제 후 해당 디렉토리는 비어있음 (재다운로드되지 않음)

3. **새로운 증상**: "/status" 커맨드에서 플러그인이 "dist"로 표시됨
   - 정상: `@ksm0709/context@0.0.6`
   - 실제: `dist`

4. **빌드 산출물 확인**:
   - `dist/index.js`에는 최신 코드 포함됨 (PLUGIN_VERSION = "0.0.6")
   - `dist/index.d.ts`는 `export {};`만 포함 (타입 정의 없음)
   - `dist/package.json` 없음

## 원인 추정

OpenCode가 플러그인 이름을 결정하는 메커니즘:

1. `package.json`의 `name` 필드에서 읽기 시도
2. 실패 시 디렉토리/파일 이름에서 추론
3. "dist"로 표시된다는 것은 메타데이터 읽기 실패 후 폴백

가능한 원인:

- npm 패키지 캐시와 OpenCode 내부 캐시 간 메타데이터 불일치
- Bun 기반 로더의 패키지 해석 버그
- `opencode.json`의 `@latest` 태그 해석 문제

## 해결 시도

**시도 1: 캐시 클리어** ❌

```bash
rm -rf ~/.cache/opencode/node_modules/@ksm0709/context
```

→ 재다운로드되지 않음

**시도 2: 로컬 개발 모드** ⏳

```json
"plugin": [
  "/home/taeho/repos/context/dist"
]
```

→ 테스트 대기 중

**시도 3: 버전 태그 명시** ⏳

```json
"plugin": [
  "@ksm0709/context@0.0.6"
]
```

→ 테스트 대기 중

## 학습

1. OpenCode 플러그인 시스템은 npm 캐싱 + Bun 로더 조합으로 복잡한 문제 발생 가능
2. 캐시 클리어 단독으로는 해결되지 않는 케이스 존재
3. "/status" 출력은 플러그인 메타데이터 로딩 상태를 진단하는 유용한 도구

## 관련

- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] -- 캐시 버전 불일치
- [[docs/gotcha-opencode-command-hook-parts-mutation.md]] -- 커맨드 훅 함정
- OpenCode 이슈 트래커: (추가 예정)
