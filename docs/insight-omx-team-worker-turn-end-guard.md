# Insight: OMX team worker turn-end guard verification

## 요약

OMX context hook의 turn-end 주입은 리더/일반 세션에서는 동작하지만, `OMX_TEAM_WORKER`가 설정된
team worker 환경에서는 `turn_end_skipped_team_worker` 가드가 먼저 실행되어 주입이 차단된다.

## 확인한 사실

- `src/omx/index.ts`는 `process.env.OMX_TEAM_WORKER`가 있으면 즉시 skip한다.
- 빌드된 `dist/omx/index.mjs`를 `OMX_TEAM_WORKER=sim-worker-1` 환경에서 직접 호출했을 때:
  - `turn_end_skipped_team_worker` 경고 로그만 남음
  - `tmux.sendKeys()`는 호출되지 않음
  - state write도 일어나지 않음
- 실제 `omx team`으로 worker pane/worktree 생성은 확인했다.

## 검증상 한계

- 실제 `omx team` end-to-end 검증은 worker trust prompt / notify 타이밍 때문에 불안정할 수 있다.
- 따라서 worker 차단 검증의 가장 신뢰도 높은 증거는
  **빌드된 OMX 모듈을 worker env로 직접 실행한 결과**이다.

## 실무 적용

- 리더 세션의 turn-end submit 문제를 조정할 때도 team worker 차단 가드는 유지해야 한다.
- worker 차단 회귀 테스트는 `OMX_TEAM_WORKER` 환경변수를 강제로 주입한 단위 테스트/모듈 호출 테스트가
  가장 안정적이다.

## 관련 노트

- [[docs/decision-omx-turn-end-investigation.md]]
- [[docs/architecture.md]]
