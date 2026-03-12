# Gotcha: npm -- unpublish 차단 (dependent packages)

## 예상 vs 실제

npm unpublish로 패키지 버전을 삭제할 수 있을 것으로 예상했으나, dependent packages가 존재한다는 이유로 E405 에러 발생.

## 우회법

- `npm deprecate`를 사용하여 해당 버전을 사용하지 않도록 권고.
- 새 버전으로 범프(bump)하여 재배포.

## 원인 (알려진 경우)

npm은 dependent packages가 있는 패키지에 대해 unpublish를 차단함.
에러: "You can no longer unpublish this package. Failed criteria: has dependent packages in the registry"
자기 자신을 dependency로 가진 경우("@ksm0709/context": "0.0.15")도 "dependent packages"로 간주될 수 있음.

## 관련

- 이슈: npm documentation
- [[docs/runbook-context-plugin-release.md]]
- [[docs/gotcha-opencode-plugin-cache-version-mismatch.md]]
