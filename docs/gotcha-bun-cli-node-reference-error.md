# Gotcha: Bun CLI -- node로 실행 시 "Bun is not defined" 레퍼런스 에러

## 예상 vs 실제

**예상**: Bun으로 빌드된 CLI 파일을 node로도 실행 가능할 것으로 기대.

**실제**: `node ./dist/cli.js` 실행 시 즉시 `ReferenceError: Bun is not defined` 크래시. 번들링된 파일 내부에서 `import.meta.path === Bun.main` 같은 Bun 전역 객체를 참조하는 코드가 포함되어 있어, node 환경에서는 실행 불가능.

```
$ node ./dist/cli.js
ReferenceError: Bun is not defined
    at file:///.../dist/cli.js:...
```

## 우회법

Bun으로 빌드된 파일은 **반드시 bun 런타임으로만 실행**:

```bash
# ❌ node로 실행하면 실패
node ./dist/cli.js

# ✅ bun으로 실행해야 정상 동작
bun ./dist/cli.js

# 또는 shebang이 있는 경우
./dist/cli.js  # bun이 설치되어 있어야 함
```

빌드 시 `--target bun`을 명시하면 Bun 전역 객체에 대한 참조가 포함됨을 인지하고, 배포/실행 환경을 bun 전용으로 설계해야 함.

## 원인 (알려진 경우)

Bun의 번들러는 `--target bun` 시 Bun 전역 API(`Bun.main`, `Bun.file`, 등)를 그대로 인라인함. 이는 node와의 호환성을 의도적으로 포기하고 Bun 런타임의 고성능/네이티브 API를 최대한 활용하기 위한 설계 선택. node에서 실행하려면 `--target node`로 빌드하거나, Bun API를 조건부로 감싸는 별도의 번들 설정이 필요함.

## 관련

- [[docs/gotcha-opencode-run-session-not-found.md]] — opencode CLI 관련 다른 gotcha
- Bun build targets: https://bun.sh/docs/bundler/executables
