# Gotcha: GitHub Actions -- 수동 태그 푸시 후 npm 자동 배포 안 됨

## 예상 vs 실제

**예상**: `npm version patch`로 버전 업데이트 후 `git tag vX.X.X`를 푸시하면 GitHub Actions가 자동으로 npm 레지스트리에 배포됨

**실제**: 태그는 생성되지만 npm 배포가 자동으로 실행되지 않음. GitHub Actions 워크플로우가 트리거되지 않음

## 우회법

수동으로 태그를 생성한 경우, GitHub Actions에서 "Publish Package" 워크플로우를 수동 실행 (`workflow_dispatch`)해야 함:

1. GitHub Repository → Actions 탭 이동
2. "Publish Package" 워크플로우 선택
3. "Run workflow" 버튼 클릭 → 태그 버전 입력 → 실행

또는 Release Please 봇이 생성하는 릴리즈 PR을 병합하여 자동 배포 트리거 사용

## 원인

프로젝트의 배포 파이프라인(`release.yml`, `publish.yml`)이 다음 이벤트에만 반응하도록 설정되어 있음:

- `repository_dispatch`: Release Please 봇이 생성한 PR 병합 시
- `workflow_dispatch`: 수동 트리거

`push` 이벤트의 `tags` 필터가 설정되어 있지 않아, 수동 태그 푸시는 워크플로우를 실행하지 않음

## 관련

- [[docs/runbook-context-plugin-release.md]] -- 릴리즈 후 캐시 동기화 절차
- [[RELEASE.md]] -- 프로젝트 릴리즈 가이드
