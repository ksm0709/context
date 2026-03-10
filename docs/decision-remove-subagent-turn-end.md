# Decision: subagentTurnEnd 설정 제거

## 결정
`subagentTurnEnd` 설정을 제거하기로 결정함.

## 근거
해당 설정은 더 이상 필요하지 않으며, 코드 복잡도를 줄이고 설정을 간소화하기 위해 제거함. 구체적으로 `ContextConfig.prompts` 및 `DEFAULTS`에서 해당 설정이 중복되어 제거됨.

## 고려한 대안
- 대안 1: 설정을 유지함 (탈락 이유: 불필요한 설정으로 인한 코드 복잡도 증가)

## 관련 노트
- [[docs/decision-subagent-infinite-loop-prevention.md]]
