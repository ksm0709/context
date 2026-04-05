# Smoke Check 설정 가이드

- [ ] `.context/config.jsonc`에 `checks`와 `smokeChecks` 배열을 설정하세요.
- [ ] 예시:
  ```jsonc
  {
    "checks": [{ "name": "tests", "signal": ".context/.check-tests-passed" }],
    "smokeChecks": [{ "name": "tests", "command": "npm test", "signal": ".context/.check-tests-passed" }]
  }
  ```
- [ ] `run_smoke_check({ name: "tests" })`로 실행 후 signal 파일이 생성되면 `submit_turn_complete`를 호출하세요.