# ADR-002: 도메인 폴더 + INDEX.md 기반 지식 구조

## 상태

Accepted

## 맥락

기존 flat 구조(`docs/*.md`)는 파일 수가 적을 때는 잘 작동하지만, 노트가 늘어날수록 문제가 생긴다:

1. **토큰 낭비**: 매 턴마다 모든 `.md` 파일의 경로+요약이 주입됨 — O(n) 스케일링
2. **탐색 어려움**: 에이전트가 관련 노트를 찾으려면 전체 목록을 읽어야 함
3. **구조 부재**: ADR, 버그, 패턴 등 도메인별 구분 없이 파일명 접두사에만 의존

## 결정

### 1. 도메인 폴더 + INDEX.md

- `docs/` 하위에 도메인별 폴더를 만들고, 각 폴더에 `INDEX.md`를 작성
- `INDEX.md`는 해당 도메인의 큐레이션된 목차 역할
- 예시: `docs/architecture/INDEX.md`, `docs/bugs/INDEX.md`

### 2. 이중 모드 (auto 감지)

- `mode: "auto"` (기본값): 하위 폴더에 `INDEX.md`가 있으면 domain 모드, 없으면 flat 모드
- `mode: "flat"`: 기존 동작 강제
- `mode: "domain"`: 도메인 모드 강제

### 3. 주입 방식 변경 (domain 모드)

기존 flat list 대신, INDEX.md 내용을 인라인으로 주입:

```markdown
## Available Knowledge

### Domains

#### docs/architecture/ (3 notes)

# Architecture Domain

...INDEX.md 내용...

### Individual Files

- AGENTS.md — # AGENTS.md
```

### 4. 하위호환성

- 기존 flat 구조 프로젝트는 변경 없이 동작 (`auto` 모드가 `flat`으로 감지)
- config에 새 필드 추가 시 모두 optional + 기본값 존재

## 결과

### 긍정적

- 도메인 구조 채택 시 토큰 사용량 대폭 감소 (개별 파일 나열 → INDEX.md 요약만)
- 에이전트가 관련 노트를 효율적으로 탐색 (INDEX.md의 "Read When..." 가이드)
- 기존 사용자는 아무것도 안 해도 됨 (100% 하위호환)

### 부정적 (트레이드오프)

- INDEX.md 유지보수 부담: 노트 추가/삭제 시 INDEX.md도 업데이트 필요
- 도메인 분류 기준이 사용자마다 다를 수 있음
- domain 모드에서 INDEX.md가 없는 폴더의 파일은 주입에서 제외됨

## 관련 노트

- [[docs/architecture.md]] — 플러그인 전체 아키텍처
- [[docs/adr-001-zettelkasten-hook-templates.md]] — 제텔카스텐 훅 콘텐츠 결정
