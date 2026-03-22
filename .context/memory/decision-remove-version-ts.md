# Decision: src/version.ts 제거 → package.json에서 직접 읽기

## 결정

`src/version.ts`를 제거하고 `scaffold.ts`에서 `package.json`을 직접 import하여 버전을 읽음.

```ts
import pkg from '../../package.json';
const PLUGIN_VERSION: string = pkg.version;
```

## 근거

`src/version.ts`는 `package.json`과 수동으로 동기화해야 하는 파일이었는데,
버전을 올릴 때 같이 업데이트하지 않아 `.version`이 최신화되지 않는 버그가 발생.

- `package.json: 0.0.8` vs `src/version.ts: 0.0.6` → `autoUpdateTemplates()` 스킵
- Bun 빌드 타겟에서 `package.json` import가 네이티브 지원됨 → 간접 레이어 불필요
- **런타임 안전**: `bun build --target bun`이 빌드 타임에 버전 값을 번들에 리터럴로 인라인.
  설치된 레포의 `package.json`을 런타임에 읽지 않으므로, 어떤 프로젝트에 플러그인을 설치해도 영향 없음.
  (`dist/index.js`에 `"0.0.8"` 리터럴로 포함된 것 확인)

## 고려한 대안

- `version.ts`를 유지하되 릴리즈 스크립트에서 자동 동기화: 외부 스크립트 의존 증가 → 탈락
- 빌드 스크립트에서 `version.ts` 자동 생성: 빌드 복잡도 증가 → 탈락

## 관련 노트

- [[docs/architecture.md]] — 버전 추적 섹션
- [[docs/runbook-context-plugin-release.md]] — 릴리즈 프로세스
