# Gotcha: Bun -- bun test로 Vitest 전용 API 실행 시 TypeError

## 예상 vs 실제

**예상**: `bun test`로 프로젝트 테스트를 실행하면 `npx vitest run`과 동일한 결과가 나올 것으로 기대.

**실제**: `bun test` 실행 시 `vi.stubGlobal`, `vi.unstubAllGlobals` 등 Vitest 전용 유틸리티 API 호출 지점에서 `TypeError: vi.stubGlobal is not a function` 에러 발생. `npx vitest run`은 135개 테스트 전부 통과.

```
$ bun test --coverage
# src/cli/cli.test.ts:14 → TypeError: vi.stubGlobal is not a function
# src/cli/commands/update.test.ts:21 → TypeError: vi.stubGlobal is not a function
# afterAll의 vi.unstubAllGlobals도 동일 에러

$ npx vitest run --coverage
# ✓ 135 tests passed
```

## 우회법

프로젝트 테스트는 반드시 **Vitest 러너**로 실행:

```bash
# ✅ 올바른 방법
npx vitest run
npx vitest run --coverage
mise run test

# ❌ 오탐 실패 발생
bun test
bun test --coverage
```

## 원인 (알려진 경우)

Bun은 자체 테스트 러너(`bun test`)를 내장하고 있으며, `describe`, `it`, `expect` 같은 기본 API는 Vitest와 호환된다. 하지만 `vi.stubGlobal`, `vi.unstubAllGlobals`, `vi.spyOn` 등 **Vitest 고유 유틸리티 API**는 Bun 테스트 러너에 구현되어 있지 않다.

`bun test`가 `.test.ts` 파일을 실행할 때 `import { vi } from 'vitest'`를 Bun 내장 호환 레이어로 해석하는데, 이 레이어에 `stubGlobal` 메서드가 없어 TypeError가 발생한다. 기본 assertion과 구조는 통과하지만, Vitest 전용 테스트 유틸리티를 사용하는 테스트만 선택적으로 실패하므로 **오탐(false failure)**으로 이어진다.

## 관련

- [[docs/gotcha-bun-cli-node-reference-error.md]] — Bun 런타임 전용 API로 인한 node 호환성 문제 (유사 패턴)
- [[docs/gotcha-bun-vitest-global-reference-error.md]] — Vitest에서 Bun 전역 직접 참조 시 import 단계 크래시
- [[docs/gotcha-bun-global-cli-version-mismatch.md]] — Bun CLI 관련 다른 gotcha
- [[AGENTS.md]] — Build & Test Commands 섹션
