# OMX Setup Guide

이 가이드는 OpenCode 플러그인 `@ksm0709/context`를 OMX(OpenCode Managed eXtension) 환경에서 설정하는 방법을 설명합니다.

## 설치

프로젝트의 `package.json`에 플러그인을 추가합니다:

```bash
npm install @ksm0709/context --save-dev
```

## 설정

1. **환경 변수 설정**: OMX 환경에서 플러그인을 활성화하려면 다음 환경 변수를 설정해야 합니다:

   ```bash
   export OMX_HOOK_PLUGINS=1
   ```

2. **플러그인 파일 배치**: `.omx/hooks/` 디렉토리에 플러그인 설정을 배치합니다.

3. **동작**:
   - 세션 시작 시 `AGENTS.md`가 자동으로 갱신됩니다.
   - 설정 파일은 `.context/` 디렉토리를 우선 탐색하며, 없을 경우 `.opencode/context/`를 fallback으로 사용합니다.

## 커스터마이징

`.context/` 디렉토리 내의 `config.jsonc`를 수정하여 지식 스캔 디렉토리나 프롬프트 경로를 변경할 수 있습니다.

자세한 아키텍처 및 상세 설정은 [[docs/architecture.md]]를 참고하세요.
