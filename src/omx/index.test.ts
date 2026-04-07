import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('./registry.js', () => ({
  ensureMcpRegistered: vi.fn().mockReturnValue(false),
}));

vi.mock('../shared/codex-settings.js', () => ({
  pruneStaleMockMcpServer: vi.fn().mockReturnValue(false),
}));

vi.mock('../lib/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/config.js')>();
  return {
    ...actual,
    loadConfig: vi.fn((dir: string) => actual.loadConfig(dir)),
  };
});

import { onHookEvent } from './index.js';
import { ensureMcpRegistered } from './registry.js';
import { pruneStaleMockMcpServer } from '../shared/codex-settings.js';

const tempDirs: string[] = [];

function createTempProjectDir(): string {
  const projectDir = join(
    tmpdir(),
    `omx-index-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  mkdirSync(projectDir, { recursive: true });
  // Create .git so resolveProjectPaths resolves to this directory
  mkdirSync(join(projectDir, '.git'));
  tempDirs.push(projectDir);
  return projectDir;
}

function setupProject(projectDir: string): void {
  mkdirSync(join(projectDir, '.context'), { recursive: true });
  mkdirSync(join(projectDir, 'docs'), { recursive: true });

  writeFileSync(join(projectDir, '.context', 'config.jsonc'), JSON.stringify({}), 'utf-8');
  writeFileSync(
    join(projectDir, 'docs', 'architecture.md'),
    '# Architecture\n\nSystem overview.',
    'utf-8'
  );
  writeFileSync(
    join(projectDir, 'AGENTS.md'),
    '# Existing AGENTS\n\nKeep this content.\n',
    'utf-8'
  );
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const projectDir of tempDirs) {
    rmSync(projectDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('onHookEvent', () => {
  it('injects workflow context into AGENTS.md on session-start', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      log: {
        info: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'session-start',
        context: {
          projectDir,
        },
      },
      sdk
    );

    const agentsMdPath = join(projectDir, 'AGENTS.md');
    const content = readFileSync(agentsMdPath, 'utf-8');

    expect(existsSync(join(projectDir, '.context'))).toBe(true);
    expect(content).toContain('# Existing AGENTS');
    expect(content).toContain('<!-- context:start -->');
    expect(content).toContain('<!-- context:end -->');
    expect(content).toContain('## Quality Gate (작업 완료 요건)');
    expect(content).toContain(
      '이 프로젝트는 **워크플로우 강제(Workflow Enforcement)** 방식으로 품질을 관리합니다.'
    );
    expect(content).toContain('### 필수 워크플로우');
    expect(content).toContain('### MCP Tools (context-mcp)');
    expect(content).toContain('### 작업 완료 프로토콜');
    expect(sdk.log.info).toHaveBeenCalledTimes(1);
  });

  it('removes stale mock-mcp from Codex config on session-start', async () => {
    vi.mocked(pruneStaleMockMcpServer).mockReturnValue(true);
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      log: {
        info: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'session-start',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(pruneStaleMockMcpServer).toHaveBeenCalledTimes(1);
    expect(sdk.log.info).toHaveBeenCalledWith(
      'Removed stale mock-mcp from ~/.codex/config.toml because its target file is missing.'
    );
  });

  it('calls ensureMcpRegistered and logs warning if it returns true on session-start', async () => {
    vi.mocked(ensureMcpRegistered).mockReturnValue(true);
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      log: {
        info: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'session-start',
        context: {
          projectDir,
          session_name: 'test-session',
        },
      },
      sdk
    );

    expect(ensureMcpRegistered).toHaveBeenCalledWith(sdk.log.info);

    const warningMsg =
      "Context MCP was just added to your OMX registry. You must stop this session, run 'omx setup', and restart to use MCP tools.";
    expect(sdk.log.info).toHaveBeenCalledWith(warningMsg);
  });

  it('ignores unrelated events', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      log: {
        info: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'session-end',
        context: {
          projectDir,
        },
      },
      sdk
    );

    const content = readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8');

    expect(content).toBe('# Existing AGENTS\n\nKeep this content.\n');
    expect(sdk.log.info).not.toHaveBeenCalled();
  });
});
