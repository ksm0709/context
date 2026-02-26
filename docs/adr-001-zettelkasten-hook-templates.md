# ADR-001: 제텔카스텐 훅 콘텐츠 + 8개 개별 노트 템플릿

## 상태

Accepted

## 맥락

turn-start/turn-end 훅 콘텐츠가 너무 추상적이어서 에이전트가 실제로 어떤 노트를 언제 작성해야 하는지 알기 어려웠다. 또한 노트 작성 시 참고할 구조화된 템플릿이 없었다.

## 결정

1. **turn-start**에 제텔카스텐 3대 원칙(원자성, 연결, 자기 언어)을 명시적으로 포함
2. **turn-end**에 8가지 상황별 트리거 조건 + 개별 템플릿 파일 링크 테이블 추가
3. **8개 개별 템플릿 파일**을 `.opencode/context/templates/`에 scaffold가 자동 생성
4. 에이전트가 해당 상황에 맞는 템플릿 파일만 선택적으로 Read (토큰 절약)

## 결과

### 긍정적

- 에이전트가 노트를 언제, 어떤 형식으로 작성해야 하는지 명확히 알 수 있음
- 8개 개별 파일로 분리하여 필요한 템플릿만 읽음 (토큰 효율)
- scaffold가 자동 생성하므로 신규 프로젝트에서도 즉시 사용 가능
- `updateScaffold()`가 11개 파일 관리 (config + 2 prompts + 8 templates)

### 부정적 (트레이드오프)

- 사용자가 템플릿을 커스터마이즈하면 `updateScaffold()` 실행 시 덮어씌워짐 (기존 정책 유지)
- 8개 파일이 추가되어 `.opencode/context/` 디렉토리가 더 복잡해짐

## 관련 노트

- [[docs/architecture.md]] — 플러그인 전체 아키텍처
- [[docs/synthetic-message-injection.md]] — 훅 메시지 주입 방식
