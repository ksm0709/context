# Decision: OMX 환경에서의 turn-end 주입 조사

## 결정

현재 스코프에서는 OMX 환경에서 `turn-complete` 이벤트와 `tmux.sendKeys`를 활용한
**turn-end 후속 리마인더**를 도입합니다. 기본값은 활성화하며, 문제가 확인되면 설정으로
명시적으로 끌 수 있게 유지합니다.

## 근거

- OMX hook plugin은 메시지 배열을 직접 수정할 수 없고, turn 경계에서 사용할 수 있는 즉시성 있는 표면은
  `turn-complete` + `tmux.sendKeys` 조합뿐입니다.
- `session-idle`는 turn 경계와 느슨하게 연결되고, `needs-input`는 파생 이벤트라 항상 발생하지 않아
  turn-end 대체로 부족합니다.
- `tmux.sendKeys` 방식은 타이밍/루프/marker 노이즈 위험이 있으므로 **가드 + 로그 + opt-out 설정**을
  전제로 채택합니다.

## 고려한 대안

- 대안 1: `session-idle` + `tmux.sendKeys` — too late, turn 종료와 직접 연결되지 않아 탈락.
- 대안 2: `needs-input` 파생 이벤트 사용 — 특정 응답 패턴에서만 발생하므로 범용 turn-end가 아니어서 탈락.
- 대안 3: `omx tmux-hook` 기반 구현 — 운영자 로컬 설정 표면이라 패키지 기본 기능으로 채택하지 않음.
- 대안 4: 별도 패키지 분리 — 현재 프로젝트 구조 대비 오버헤드가 커서 탈락.

## 운영 원칙

- 기본 전략은 `omx.turnEnd.strategy = "turn-complete-sendkeys"` 입니다.
- 필요 시 `omx.turnEnd.strategy = "off"` 로 끌 수 있습니다.
- team worker 환경에서는 비활성화합니다.
- 동일 `turn_id`에는 한 번만 전송합니다.
- 주입이 만든 바로 다음 follow-up turn은 세션 단위로 1회 suppress 합니다.
- 실패 시 세션을 깨지 않고 로그만 남깁니다.
- marker/루프/사용성 문제가 발견되면 기본값 재검토 대상으로 간주합니다.

## 관련 노트

- [[docs/adr-003-omx-compatibility.md]]
- [[docs/architecture.md]]
