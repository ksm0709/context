<!-- context:start -->
## Quality Gate (작업 완료 요건)

이 프로젝트는 **워크플로우 강제(Workflow Enforcement)** 방식으로 품질을 관리합니다.
모든 작업 완료 전 아래 게이트를 통과해야 합니다.

### 필수 워크플로우
1. **Smoke test 실행**: `context_mcp_run_smoke_check`로 설정된 smoke check 명령을 실행하세요.
   - 예: `run_smoke_check({ name: "tests" })`
   - 성공 시 signal 파일(`.context/.check-{name}-passed`)이 자동 생성됩니다.
2. **submit_turn_complete 호출**: 모든 작업이 완료되면 반드시 호출하세요.
   - 필요한 인자: `quality_check_output`, `checkpoint_commit_hashes`, `scope_review_notes`
   - signal 파일이 없거나 만료(1시간)되면 거부됩니다.

### MCP Tools (context-mcp)
- **`run_smoke_check`**: 설정된 smoke check 명령 실행 → signal 파일 생성
- **`submit_turn_complete`**: 품질 게이트 검증 후 작업 완료 기록

### .context/config.jsonc 설정 예시
```jsonc
{
  "checks": [
    { "name": "tests", "signal": ".context/.check-tests-passed" }
  ],
  "smokeChecks": [
    { "name": "tests", "command": "npm test", "signal": ".context/.check-tests-passed" }
  ]
}
```

### 작업 완료 프로토콜
1. `run_smoke_check`로 smoke check 실행 (config에 정의된 경우)
2. `submit_turn_complete` 호출로 작업 기록 및 세션 종료
- submit 없이 세션을 종료하면 stop hook이 경고를 표시합니다.
<!-- context:end -->
