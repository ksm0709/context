# Decision: OMX 환경에서의 turn-end 주입 조사

## 결정

이번 스코프에서는 OMX 환경에서 `turn-complete` 이벤트와 `tmux.sendKeys`를 활용한 `turn-end` 주입 구현을 제외하기로 결정했습니다.

## 근거

- `tmux.sendKeys` 방식은 타이밍 이슈와 루프 가드(loop guard) 설정 등 복잡한 안정성 문제를 동반합니다.
- 현재 구현된 `experimental.chat.messages.transform` 훅 기반의 주입 방식이 OMX 환경에서도 동작할 가능성이 높으므로, 우선 기존 방식의 호환성을 검증하는 것이 효율적입니다.
- 안정적인 구현을 위해서는 별도의 실험과 검증 과정이 필요합니다.

## 고려한 대안

- 대안 1: `tmux.sendKeys`를 통한 즉각적인 `turn-end` 주입 — 구현 복잡도와 안정성 위험으로 인해 탈락.
- 대안 2: 별도 패키지로 분리하여 구현 — 현재 프로젝트 구조상 오버헤드가 크다고 판단하여 탈락.

## 관련 노트

- [[docs/adr-003-omx-compatibility.md]]
- [[docs/architecture.md]]
