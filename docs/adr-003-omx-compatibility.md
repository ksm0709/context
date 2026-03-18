# ADR-003: OMX 호환성 및 turn-end 주입 전략

## 상태

Accepted

## 맥락

현재 `@ksm0709/context` 플러그인은 OpenCode 환경에 최적화되어 있습니다. 최근 OMX(OpenCode-like environment) 환경에서의 사용 수요가 증가함에 따라, OMX 환경에서도 안정적으로 동작할 수 있는 호환성 확보가 필요합니다. 특히, 에이전트의 턴 종료 시점을 명확히 인지하고 필요한 후속 작업을 수행하기 위한 `turn-end` 주입 방식의 개선이 요구됩니다.

## 결정

1. **환경 중립적 디렉토리 구조**: `.context/` 디렉토리를 사용하여 OpenCode 전용 경로(`.opencode/context/`)와 분리하고, 환경에 따라 설정 경로를 유연하게 선택할 수 있도록 합니다.
2. **멀티 엔트리 패키지**: OpenCode 플러그인과 OMX용 CLI 도구를 패키지 내에서 명확히 분리하여 관리합니다.
3. **AGENTS.md 자동 관리**: 환경별로 필요한 `AGENTS.md` 설정을 자동 관리하는 방식을 채택합니다.
4. **turn-end 주입**: 현재의 `experimental.chat.messages.transform` 훅을 통한 주입 방식을 유지하되, OMX 환경에서의 안정성을 위해 별도 검증을 수행합니다.

## 결과

### 긍정적

- OpenCode와 OMX 환경 간의 설정 충돌 방지
- 환경별 최적화된 프롬프트 및 설정 관리 가능

### 부정적 (트레이드오프)

- AGENTS.md 방식은 정적이며 실시간 환경 변화를 즉각 반영하지 못하는 한계가 있음
- 환경별 설정 관리로 인한 유지보수 복잡도 증가

## 관련 노트

- [[docs/decision-omx-turn-end-investigation.md]]
- [[docs/architecture.md]]
