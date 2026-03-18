# Insight: OMX turn-end follow-up loop suppression

## 문제

OMX turn-end는 `turn-complete`에서 `<system-reminder>`를 새 입력으로 주입한다.
이 reminder는 새 user turn이 되므로, 그 응답이 끝난 뒤 다시 `turn-complete`가 발생하면서
turn-end가 연속으로 한 번 더 들어올 수 있다.

## 원인

- 기존 가드는 `last_turn_end_turn_id`만 보고 같은 turn 중복만 막았다.
- 하지만 연속 주입은 **같은 turn 재처리**가 아니라 **주입이 만든 다음 turn** 이라서
  `turn_id`가 서로 달랐다.

## 해결

- `session_id` 우선, 없으면 `thread_id`를 scope key로 사용한다.
- turn-end 주입 성공 직후 `turn_end_pending_followup_scopes`에 scope를 기록한다.
- 다음 `turn-complete`에서 해당 scope가 있으면:
  - `turn_end_skipped_followup_turn` 로그를 남기고
  - pending scope를 삭제한 뒤
  - 추가 주입 없이 종료한다.

## 효과

- 일반 assistant turn에는 turn-end가 계속 동작한다.
- turn-end가 만든 follow-up turn에는 한 번만 suppress가 적용된다.
- team worker guard, duplicate turn guard와 충돌하지 않는다.

## 관련 노트

- [[docs/decision-omx-turn-end-investigation.md]]
- [[docs/insight-omx-team-worker-turn-end-guard.md]]
