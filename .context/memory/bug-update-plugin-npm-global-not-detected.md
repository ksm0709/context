# Bug: context update plugin이 npm/nvm 글로벌 설치를 감지·갱신하지 못함

## 증상

- `context update plugin` 실행 후 `context -v`가 여전히 구버전(0.0.14) 표시
- `bunx @ksm0709/context@0.0.16 --version`은 정상(0.0.16) — npm에서 직접 가져오면 올바름
- `which context` → `/home/user/.nvm/versions/node/v22.17.0/bin/context` (npm 글로벌)

## 원인

`isGloballyInstalled()`가 `~/.bun/bin/context`만 체크.
셸이 실제로 사용하는 npm/nvm 글로벌 바이너리(`/home/user/.nvm/versions/node/*/bin/context`)를 감지하지 못해,
`runUpdatePlugin()`이 bun 글로벌만 업데이트하고 npm 글로벌은 건드리지 않음.

```
which context → /home/user/.nvm/.../bin/context  ← 셸이 사용하는 바이너리 (npm 글로벌)
~/.bun/bin/context                                ← isGloballyInstalled()가 체크하는 경로
```

## 해결

`detectGlobalInstalls()` 도입 — `which context`로 활성 바이너리 경로를 확인하여 bun/npm 글로벌을 모두 감지.

```ts
export function detectGlobalInstalls(): GlobalInstall[] {
  const installs: GlobalInstall[] = [];
  // bun 글로벌 체크
  if (existsSync(join(homedir(), '.bun', 'bin', 'context'))) {
    installs.push({ pm: 'bun', label: 'bun global', installCmd: ['bun', 'install', '-g'] });
  }
  // npm/nvm 글로벌 — which context 결과가 .bun이 아니면 npm으로 판정
  const whichResult = spawnSync(['which', 'context']);
  if (whichResult.exitCode === 0) {
    const binPath = whichResult.stdout.toString().trim();
    if (binPath && !binPath.includes('.bun') && !binPath.includes('node_modules')) {
      installs.push({ pm: 'npm', label: 'npm global', installCmd: ['npm', 'install', '-g'] });
    }
  }
  return installs;
}
```

`runUpdatePlugin()`은 감지된 모든 글로벌 설치를 순회하며 각각의 패키지 매니저로 업데이트.

## 예방

- 글로벌 설치 감지 시 하드코딩된 경로 하나만 체크하지 말고, 셸의 실제 바이너리 해석 경로(`which`)를 확인할 것
- 여러 패키지 매니저가 공존하는 환경(bun + npm/nvm)을 항상 고려

## 관련 노트

- [[docs/decision-cli-update-subcommands.md]] — CLI update 서브커맨드 체계
- [[docs/gotcha-bun-global-cli-version-mismatch.md]] — Bun 글로벌 CLI 버전 불일치
- [[docs/decision-remove-version-ts.md]] — package.json에서 버전 직접 읽기 (빌드 시 인라인)
