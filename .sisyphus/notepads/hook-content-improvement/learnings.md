## [2026-02-26] T4 완료: DEFAULT_TURN_END 리라이트
- 8가지 템플릿 유형별 트리거 조건 + 개별 파일 링크 테이블 추가
- 각 템플릿 이름에 .opencode/context/templates/*.md 링크 포함
- 기존 퀄리티 체크리스트(lint, 타입, 테스트) 유지
- 노트 작성 규칙 업데이트


## [2026-02-26] T5 완료 (재시도): scaffold 함수 업데이트
- scaffoldIfNeeded(): templatesDir = join(contextDir, 'templates') 생성 + TEMPLATE_FILES 순회
- updateScaffold(): mkdirSync templates + templateEntries spread 패턴으로 11개 관리
- eslint-disable-next-line no-unused-vars 주석 제거## [2026-02-26] T6 완료: scaffold.test.ts 업데이트
- scaffoldIfNeeded: templates 디렉토리 생성, 8개 파일 생성, 파일 내용 키워드 테스트 추가
- updateScaffold: templates 디렉토리 생성, 템플릿 파일 업데이트 테스트 추가
- 총 테스트: 9 → 14개
