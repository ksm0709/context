export const STATIC_KNOWLEDGE_CONTEXT = `## Knowledge Context

이 프로젝트는 **제텔카스텐(Zettelkasten)** 방식으로 지식을 관리합니다.
세션 간 컨텍스트를 보존하여, 이전 세션의 결정/패턴/실수가 다음 세션에서 재활용됩니다.

### 제텔카스텐 핵심 원칙
1. **원자성** -- 하나의 노트 = 하나의 주제. 여러 주제를 섞지 마세요.
2. **연결** -- 모든 노트는 [[wikilink]]로 관련 노트에 연결. 고립된 노트는 발견되지 않습니다.
3. **자기 언어** -- 복사-붙여넣기가 아닌, 핵심을 이해하고 간결하게 서술하세요.

### MCP Tools
- **지식 탐색**: \`context_mcp_search_knowledge\`로 후보 노트를 찾고, 결과의 title / description / tags / path / score를 먼저 비교하세요.
- **노트 열기**: \`context_mcp_read_knowledge\`로 선택한 노트를 열고, 끝에 붙는 related notes 메타데이터로 다음 탐색 경로를 정하세요.
- **노트 작성/수정**: \`context_mcp_create_knowledge_note\`, \`context_mcp_update_knowledge_note\`
- **데일리 노트**: \`context_mcp_read_daily_note\`, \`context_mcp_append_daily_note\`
- **작업 완료**: \`context_mcp_submit_turn_complete\` (작업 종료 시 필수 호출)

### 작업 전 필수
- **데일리 노트 확인**: 가장 최근의 데일리 노트를 읽고 이전 세션의 컨텍스트와 미해결 이슈를 파악하세요.
- **작업 의도 선언**: 작업 시작 전, 현재 세션의 목표와 작업 의도를 명확히 파악하고 선언하세요.
- **메타데이터 우선 검색**: 먼저 \`search_knowledge\`로 관련 후보를 찾고, 메타데이터를 비교한 뒤 가장 유력한 노트를 \`read_knowledge\`로 여세요.
- **관련 노트 추적**: \`read_knowledge\` 끝의 related notes 섹션에서 연결된 노트의 title / description / tags / path를 확인하고 필요시 연쇄 탐색하세요.
- 지식 파일에 기록된 아키텍처 결정, 패턴, 제약사항을 반드시 따르세요.

### 개발 원칙
- **TDD** (Test-Driven Development): 테스트를 먼저 작성하고(RED), 구현하여 통과시킨 뒤(GREEN), 리팩토링하세요.
- **DDD** (Domain-Driven Design): 도메인 개념을 코드 구조에 반영하세요.
- **테스트 커버리지**: 새로 작성하거나 변경한 코드는 테스트 커버리지 80% 이상을 목표로 하세요.

### 우선순위
- AGENTS.md의 지시사항이 항상 최우선
- 지식 노트의 결정사항 > 일반적 관행
- 지식 노트에 없는 새로운 결정이나 반복 가치가 있는 발견은 작업 메모나 지식 노트 후보로 기록하세요.

### 작업 완료 프로토콜
- **필수**: 모든 작업이 완료되면 반드시 \`context-mcp\` MCP 서버의 \`submit_turn_complete\` 도구를 호출하세요.
- 이 호출 없이 세션을 종료하면 작업 기록이 보존되지 않습니다.
- 필요한 인자: daily_note_update_proof, knowledge_note_proof, quality_check_output, checkpoint_commit_hashes, scope_review_notes`;
