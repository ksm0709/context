# Runbook: GitHub Actions Trusted Publishing 설정 및 활용

## 목적

GitHub Actions에서 수동 태그 푸시 시 npm 자동 배포가 트리거되지 않는 문제를 해결하고, 보안이 강화된 Trusted Publishing 방식을 활용하여 배포 흐름을 자동화합니다.

## 사전 조건

- GitHub Repository에 npm 패키지 등록 완료
- GitHub Actions 워크플로우 파일(`release.yml`, `publish.yml`) 존재

## 단계

1. **Trusted Publishing 설정**:
   - npm 레지스트리에서 GitHub Actions를 위한 OIDC(OpenID Connect) 기반 Trusted Publishing을 설정합니다.
   - npm 계정 설정에서 GitHub 저장소를 신뢰할 수 있는 퍼블리셔로 등록합니다.

2. **워크플로우 업데이트**:
   - `publish.yml` 워크플로우에서 `npm publish` 실행 시 별도의 `NPM_TOKEN` 대신 OIDC 토큰을 사용하도록 수정합니다.
   - `permissions` 블록에 `id-token: write` 권한을 추가합니다.

3. **배포 트리거 확인**:
   - 수동 태그 푸시 대신, Release Please 봇이 생성한 릴리즈 PR을 병합하여 배포를 트리거합니다.
   - 수동 배포가 필요한 경우 `workflow_dispatch`를 사용합니다.

## 확인 방법

- GitHub Actions "Publish Package" 워크플로우 실행 결과 확인
- npm 레지스트리에 패키지 버전이 정상적으로 게시되었는지 확인

## 문제 해결

| 증상              | 해결                                    |
| ----------------- | --------------------------------------- |
| OIDC 인증 실패    | npm 설정에서 GitHub 저장소 정보 재확인  |
| 배포 트리거 안 됨 | `release.yml`의 이벤트 트리거 설정 확인 |

## 관련 노트

- [[docs/gotcha-github-actions-manual-tag-publish.md]] — 수동 태그 푸시 문제
- [[docs/runbook-context-plugin-release.md]] — 릴리즈 후 캐시 동기화 절차
