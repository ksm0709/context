# Gotcha: OpenCode -- /status에서 플러그인 이름이 "dist"로 표시됨

## 예상 vs 실제

**예상**: `/status`에서 `@ksm0709/context`로 표시됨

**실제**: `/status`에서 `dist`로 표시됨

## 원인

OpenCode 바이너리(`~/.opencode/bin/opencode`)에 번들된 `getPluginName()` 함수:

```js
function getPluginName(plugin) {
  if (plugin.startsWith('file://')) {
    return path.parse(new URL(plugin).pathname).name; // ← file:// 전용 분기
  }
  const lastAt = plugin.lastIndexOf('@');
  if (lastAt > 0) return plugin.substring(0, lastAt); // "@ksm0709/context"
  return plugin;
}
```

동작:

- `"@ksm0709/context@latest"` → `"@ksm0709/context"` ✓
- `"file://.../@ksm0709/context/dist/index.js"` → `path.parse(...).name` = `"index"` ⚠️
- `"file://.../@ksm0709/context/dist"` → `path.parse(...).name` = `"dist"` ← 실제 발생

**핵심**: OpenCode가 `@ksm0709/context@latest`를 내부적으로 `pathToFileURL(resolvedPath).href` 형태로 변환할 때, resolve 결과가 `dist/` 디렉토리를 가리키면 `"dist"`가 추출됨. `/status` UI는 `getPluginName(specifier)`를 통해 표시.

출처: `packages/opencode/src/config/config.ts` (anomalyco/opencode 리포)

## 진짜 원인 (Deep Dive)

`opencode.json`에 `"@ksm0709/context@latest"`라고 명시했음에도 불구하고 `/status`에서 `index`(또는 `dist`, `context`)로 나오는 근본적인 원인은 **`package.json`의 export 설정 누락으로 인한 OpenCode의 Fallback 메커니즘 발동**입니다.

1. **Bun의 모듈 리졸루션 실패**: `package.json`에 `"main"` 필드와 `"exports": { "import": "..." }`가 없으면, Bun은 `node_modules` 내의 패키지를 `import("@ksm0709/context")` 형태로 불러올 때 진입점을 찾지 못하고 에러(`Cannot find module`)를 던집니다.
2. **OpenCode의 Fallback 동작**: OpenCode는 캐시 디렉토리(`~/.cache/opencode/node_modules`)에서 플러그인 임포트가 실패하면, 이를 대비한 fallback 경로(`~/.config/opencode/node_modules`)에서 `Bun.resolveSync`를 이용해 **절대 경로 파일(`dist/index.js`)**을 찾아냅니다.
3. **URL 변환 및 로딩**: 찾아낸 절대 경로를 `pathToFileURL`을 통해 `file:///.../dist/index.js` 형태의 URL로 변환하여 플러그인을 로드합니다.
4. **이름 추출 버그**: OpenCode의 `getPluginName()` 함수는 `file://` URL을 받으면 패키지명이 아닌 **파일명(`path.parse().name`)**을 추출합니다. 따라서 `index.js`면 `"index"`, `context.js`면 `"context"`가 `/status`에 표시됩니다.

## 완벽한 해결책

`package.json`에 Bun이 ESM 모듈을 정상적으로 리졸브할 수 있도록 `"main"`과 `"import"` 조건을 명시해야 합니다.

```json
{
  "name": "@ksm0709/context",
  "type": "module",
  "main": "./dist/index.js", // 핵심 1
  "exports": {
    ".": {
      "import": "./dist/index.js", // 핵심 2
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

이렇게 수정하면 OpenCode가 `file://` 폴백을 타지 않고 `"@ksm0709/context@latest"` 식별자 그대로 로딩에 성공하며, `/status`에도 `@ksm0709/context`라는 명확한 이름이 노출됩니다.

*(참고: 0.0.5 이전 버전에서 문제가 없다고 느꼈던 것은 캐시나 로컬 환경 설정 차이로 우연히 폴백을 타지 않았거나, 이름을 미처 인지하지 못했을 가능성이 큽니다.)*

## 관련

- [[docs/insight-opencode-plugin-loading-debugging.md]] -- 캐시 버전 불일치로 file:// fallback이 발생하는 원인
- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]] -- 캐시 lock 버전 고정 패턴
- [[docs/runbook-context-plugin-release.md]] -- 릴리즈 후 캐시 동기화 절차