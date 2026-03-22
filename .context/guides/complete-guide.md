# 작업 완료 가이드

- [ ] 모든 커밋 및 푸시 작업 완료 후 수행하세요.
- [ ] 프로젝트 루트에 `.context/.work-complete` 파일을 생성하거나 덮어쓰세요.
- [ ] 파일 내용은 `.context/templates/work-complete.txt` 템플릿을 복사하여 작성해야 합니다. (정확히 아래 3줄 형식이어야 합니다):
  timestamp={{currentTimestamp}}
  session_id={{sessionId}}
  turn_id={{turnId}}
- [ ] 이 동작은 작업 완료를 시스템에 알리고 프롬프트 주입 루프를 종료시키는 트리거입니다.