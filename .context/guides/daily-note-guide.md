# 세션 기록 가이드

- [ ] 세션 완료 후 `submit_turn_complete` MCP 도구를 호출하여 작업을 기록하세요.
- [ ] 필요한 인자: `quality_check_output`, `checkpoint_commit_hashes`, `scope_review_notes`
- [ ] smoke check가 완료된 후 호출해야 signal 파일 검증이 통과됩니다.