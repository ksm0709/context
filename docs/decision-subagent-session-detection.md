# Decision: 서브에이전트 세션 감지를 위한 parentID 기반 유틸리티 도입

## 결정

서브에이전트 세션을 효율적으로 감지하기 위해 `parentID`를 활용하는 `isSubagentSession` 유틸리티 함수를 구현하고, 성능 최적화를 위해 캐싱 메커니즘을 적용한다.

## 근거

서브에이전트 여부를 판단하기 위해 매번 `getSession`을 호출하는 것은 불필요한 오버헤드를 발생시킨다. `parentID`의 존재 여부를 통해 세션 계층을 파악하고, 결과를 캐싱함으로써 반복적인 세션 조회 비용을 최소화한다.

## 고려한 대안

- 매번 `getSession` 호출: 탈락 — 성능 저하 및 API 호출 증가.
- 세션 상태를 전역 변수로 관리: 탈락 — 상태 동기화 문제 및 복잡성 증가.

## 관련 노트

- [[docs/decision-subagent-infinite-loop-prevention.md]]
