# Decision: Remove Subagent Delegation from Prompt Flow

서브에이전트 위임(subagent delegation) 기능을 프롬프트 흐름에서 제거하기로 결정했습니다.

## 배경

기존에는 `turn-start` 프롬프트에서 지식 노트 탐색을 서브에이전트에 위임하는 구조를 사용했으나, 이는 복잡성을 증가시키고 무한 루프 및 세션 감지 문제를 야기했습니다.

## 결정

- 서브에이전트 위임 로직을 프롬프트 주입 흐름에서 완전히 제거합니다.
- 관련 문서(`decision-subagent-infinite-loop-prevention.md`, `decision-subagent-session-detection.md`, `decision-turn-start-subagent-delegation.md`, `decision-remove-subagent-turn-end.md`)는 `docs/archive/subagent/`로 이동하여 기본 지식 스캔에서 제외합니다.
- `docs/architecture.md`를 업데이트하여 서브에이전트가 없는 단순화된 주입 모델을 기술합니다.

## 영향

- 프롬프트 주입이 단순화되어 안정성이 향상됩니다.
- 서브에이전트 관련 복잡한 로직이 제거되어 유지보수가 용이해집니다.
