# Changelog

All notable changes to this project will be documented in this file.

## [0.0.7] - 2025-03-01

### Fixes

- **command.execute.before 타입 에러 수정**: `Part` 객체에 필수 필드 `id`, `sessionID`, `messageID` 추가

## [0.0.6] - 2025-03-01

All notable changes to this project will be documented in this file.

## [0.0.6] - 2025-03-01

### Features

- **Domain-based INDEX.md knowledge structure**: 도메인 폴더 + `INDEX.md` 기반 지식 관리. `mode: "auto"` 감지로 하위호환 유지. 개별 파일 나열 대신 INDEX.md 내용만 주입하여 토큰 절약
- `scanDomains()`, `detectKnowledgeMode()`, `formatDomainIndex()`, `buildKnowledgeIndexV2()` 함수 추가
- Config에 `mode`, `indexFilename`, `maxDomainDepth` optional 필드 추가
- INDEX.md scaffold 템플릿 추가 (9번째 템플릿)

### Improvements

- turn-end 퀄리티 체크리스트 개선: 타입 에러 확인 → formatter 실행 + 변경 범위 확인으로 교체
- turn-start에 TDD/DDD 개발 원칙 가이드 추가
- turn-start/turn-end에 테스트 커버리지 80% 목표 추가
- turn-start에 도메인 폴더 INDEX.md 네비게이션 안내 추가

### Docs

- ADR-002: 도메인 폴더 + INDEX.md 기반 지식 구조 결정 문서
- architecture.md 업데이트: 이중 모드(flat/domain) 스캐닝, 새 상수, scaffold 12개 파일 반영

## [0.0.5] - 2025-02-28

### Fixes

- knowledge index를 system prompt에서 user message로 이동 — turn-start와 같은 text part에 결합하여 공간적 참조 유지

### Docs

- Bug note: knowledge index 공간적 참조 깨짐 문제 기록

## [0.0.4] - 2025-02-27

### Features

- Zettelkasten 가이드 + 8개 노트 템플릿을 turn-start/turn-end 훅 콘텐츠에 추가
- scaffold가 `.opencode/context/templates/` 디렉토리에 8개 템플릿 자동 생성

### Docs

- ADR-001: 제텔카스텐 훅 콘텐츠 + 8개 개별 노트 템플릿 결정 문서

## [0.0.3] - 2025-02-26

### Features

- Synthetic 메시지에서 실제 user message 기반 프롬프트 주입으로 전환
- `/context-update` 커맨드 추가 — scaffold 파일을 최신 플러그인 버전으로 업데이트
- Zettelkasten을 기본 지식 관리 방식으로 채택

### Refactoring

- turn-end 주입을 system prompt에서 별도 user message로 이동

## [0.0.2] - 2025-02-25

### Features

- `knowledge.dir` config 옵션 추가, scaffold 프롬프트 개선
- 파일 기반 프롬프트 주입 플러그인 초기 구현

### Docs

- Plugin architecture 문서 작성
- AGENTS.md에 플러그인 개발 가이드라인 추가

## [0.0.1] - 2025-02-25

- Initial release from bun-module template
