import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('./tmux-submit.js', () => ({
  sendTmuxSubmitSequence: vi.fn().mockResolvedValue({
    ok: true,
    attempts: 3,
  }),
}));

vi.mock('../lib/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/config.js')>();
  return {
    ...actual,
    loadConfig: vi.fn((dir: string) => {
      const config = actual.loadConfig(dir);
      return {
        ...config,
        prompts: {
          turnStart: join(dir, '.context', 'prompts', 'turn-start.md'),
          turnEnd: join(dir, '.context', 'prompts', 'turn-end.md'),
        },
      };
    }),
  };
});

import { onHookEvent } from './index.js';
import { sendTmuxSubmitSequence } from './tmux-submit.js';

const tempDirs: string[] = [];

function createTempProjectDir(): string {
  const projectDir = join(
    tmpdir(),
    `omx-index-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  mkdirSync(projectDir, { recursive: true });
  tempDirs.push(projectDir);
  return projectDir;
}

function setupProject(projectDir: string): void {
  mkdirSync(join(projectDir, '.context', 'prompts'), { recursive: true });
  mkdirSync(join(projectDir, 'docs'), { recursive: true });

  writeFileSync(
    join(projectDir, '.context', 'config.jsonc'),
    JSON.stringify({
      prompts: {
        turnStart: 'prompts/turn-start.md',
        turnEnd: 'prompts/turn-end.md',
      },
      knowledge: {
        dir: 'docs',
        sources: ['AGENTS.md'],
      },
    }),
    'utf-8'
  );
  writeFileSync(
    join(projectDir, '.context', 'prompts', 'turn-start.md'),
    '## OMX Knowledge Context\n\nRead from {{knowledgeDir}} first.',
    'utf-8'
  );
  writeFileSync(
    join(projectDir, '.context', 'prompts', 'turn-end.md'),
    '## OMX Turn End\n\nSave notes to {{knowledgeDir}}.',
    'utf-8'
  );
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
  vi.mocked(sendTmuxSubmitSequence).mockResolvedValue({
    ok: true,
    attempts: 3,
  });

  for (const projectDir of tempDirs) {
    rmSync(projectDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('onHookEvent', () => {
  it('injects turn-start and knowledge index into AGENTS.md on session-start', async () => {
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
    expect(content).toContain('## Knowledge Context');
    expect(content).toContain(
      '이 프로젝트는 **제텔카스텐(Zettelkasten)** 방식으로 지식을 관리합니다.'
    );
    expect(content).toContain('### 제텔카스텐 핵심 원칙');
    expect(content).toContain('### 작업 전 필수');
    expect(content).toContain('### 개발 원칙');
    expect(content).toContain('### 우선순위');
    expect(sdk.log.info).toHaveBeenCalledTimes(1);
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

  it('sends turn-end reminder via tmux on turn-complete when strategy is enabled', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);
    writeFileSync(
      join(projectDir, '.context', 'config.jsonc'),
      JSON.stringify({
        prompts: {
          turnStart: 'prompts/turn-start.md',
          turnEnd: 'prompts/turn-end.md',
        },
        knowledge: {
          dir: 'notes',
          sources: ['AGENTS.md'],
        },
        omx: {
          turnEnd: {
            strategy: 'turn-complete-sendkeys',
          },
        },
      }),
      'utf-8'
    );

    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%10',
          paneId: '%10',
        }),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockResolvedValue(undefined),
        write: vi.fn().mockResolvedValue(undefined),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-1',
        turn_id: 'turn-1',
        context: {
          projectDir,
          session_name: 'leader',
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).toHaveBeenCalledTimes(1);
    expect(sdk.tmux.sendKeys).toHaveBeenCalledWith({
      sessionName: 'leader',
      text: `<system-reminder>\nTURN END. You MUST call the 'submit_turn_complete' MCP tool to finalize your work and record notes. Do not wait for user input.\n</system-reminder>`,
      submit: false,
    });
    expect(sendTmuxSubmitSequence).toHaveBeenCalledWith('%10');
    expect(sdk.state.write).toHaveBeenCalledWith('last_turn_end_turn_id', 'turn-1');
    expect(sdk.state.write).toHaveBeenCalledWith('turn_end_pending_followup_scopes', {
      'session:session-1': {
        sourceTurnId: 'turn-1',
        createdAt: expect.any(Number),
      },
    });
    expect(sdk.log.info).toHaveBeenCalledWith(
      'turn_end_submit_sequence_sent',
      expect.objectContaining({
        session_id: 'session-1',
        turn_id: 'turn-1',
        target: '%10',
        submit_attempts: 3,
      })
    );
    expect(sdk.log.info).toHaveBeenCalledWith(
      'turn_end_sent',
      expect.objectContaining({
        session_id: 'session-1',
        turn_id: 'turn-1',
        target: '%10',
      })
    );
  });

  it('uses default turn-end strategy when config omits OMX settings', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%11',
          paneId: '%11',
        }),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockImplementation((key: string) => {
          if (key === 'turn_end_pending_followup_scopes') {
            return Promise.resolve({});
          }

          return Promise.resolve(undefined);
        }),
        write: vi.fn().mockResolvedValue(undefined),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-default',
        turn_id: 'turn-default',
        context: {
          projectDir,
          session_name: 'leader',
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).toHaveBeenCalledTimes(1);
    expect(sendTmuxSubmitSequence).toHaveBeenCalledWith('%11');
    expect(sdk.state.write).toHaveBeenCalledWith('last_turn_end_turn_id', 'turn-default');
  });

  it('skips exactly one follow-up turn after a successful turn-end injection', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const stateWrites: Array<{ key: string; value: unknown }> = [];
    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%13',
          paneId: '%13',
        }),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockImplementation((key: string) => {
          if (key === 'turn_end_pending_followup_scopes') {
            return Promise.resolve({
              'session:session-followup': {
                sourceTurnId: 'turn-source',
                createdAt: 123,
              },
            });
          }

          return Promise.resolve(undefined);
        }),
        write: vi.fn().mockImplementation((key: string, value: unknown) => {
          stateWrites.push({ key, value });
          return Promise.resolve(undefined);
        }),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-followup',
        turn_id: 'turn-followup',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).not.toHaveBeenCalled();
    expect(sendTmuxSubmitSequence).not.toHaveBeenCalled();
    expect(stateWrites).toContainEqual({
      key: 'turn_end_pending_followup_scopes',
      value: {},
    });
    expect(sdk.log.info).toHaveBeenCalledWith(
      'turn_end_skipped_followup_turn',
      expect.objectContaining({
        session_id: 'session-followup',
        turn_id: 'turn-followup',
        scope_key: 'session:session-followup',
      })
    );
  });

  it('does not suppress other sessions when pending follow-up belongs elsewhere', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%14',
          paneId: '%14',
        }),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockImplementation((key: string) => {
          if (key === 'turn_end_pending_followup_scopes') {
            return Promise.resolve({
              'session:another-session': {
                sourceTurnId: 'turn-source',
                createdAt: 123,
              },
            });
          }

          return Promise.resolve(undefined);
        }),
        write: vi.fn().mockResolvedValue(undefined),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-current',
        turn_id: 'turn-current',
        context: {
          projectDir,
          session_name: 'leader',
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).toHaveBeenCalledTimes(1);
    expect(sendTmuxSubmitSequence).toHaveBeenCalledWith('%14');
  });

  it('skips turn-end reminder when strategy is explicitly off', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);
    writeFileSync(
      join(projectDir, '.context', 'config.jsonc'),
      JSON.stringify({
        omx: {
          turnEnd: {
            strategy: 'off',
          },
        },
        knowledge: {
          sources: ['AGENTS.md'],
        },
      }),
      'utf-8'
    );

    const sdk = {
      tmux: {
        sendKeys: vi.fn(),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockResolvedValue(undefined),
        write: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        turn_id: 'turn-off',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).not.toHaveBeenCalled();
    expect(sendTmuxSubmitSequence).not.toHaveBeenCalled();
    expect(sdk.log.info).not.toHaveBeenCalledWith('turn_end_sent', expect.anything());
  });

  it('skips duplicate turn-complete reminders for the same turn', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);
    writeFileSync(
      join(projectDir, '.context', 'config.jsonc'),
      JSON.stringify({
        prompts: {
          turnEnd: 'prompts/turn-end.md',
        },
        knowledge: {
          sources: ['AGENTS.md'],
        },
        omx: {
          turnEnd: {
            strategy: 'turn-complete-sendkeys',
          },
        },
      }),
      'utf-8'
    );

    const sdk = {
      tmux: {
        sendKeys: vi.fn(),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockResolvedValue('turn-1'),
        write: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        turn_id: 'turn-1',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).not.toHaveBeenCalled();
    expect(sendTmuxSubmitSequence).not.toHaveBeenCalled();
    expect(sdk.log.info).toHaveBeenCalledWith(
      'turn_end_skipped_duplicate_turn',
      expect.objectContaining({ turn_id: 'turn-1' })
    );
  });

  it('skips turn-complete reminders for team workers', async () => {
    const originalTeamWorker = process.env.OMX_TEAM_WORKER;
    process.env.OMX_TEAM_WORKER = 'worker-1';

    try {
      const projectDir = createTempProjectDir();
      setupProject(projectDir);
      writeFileSync(
        join(projectDir, '.context', 'config.jsonc'),
        JSON.stringify({
          omx: {
            turnEnd: {
              strategy: 'turn-complete-sendkeys',
            },
          },
          knowledge: {
            sources: ['AGENTS.md'],
          },
        }),
        'utf-8'
      );

      const sdk = {
        tmux: {
          sendKeys: vi.fn(),
        },
        log: {
          info: vi.fn(),
          warn: vi.fn(),
        },
        state: {
          read: vi.fn().mockResolvedValue(undefined),
          write: vi.fn(),
        },
      };

      await onHookEvent(
        {
          event: 'turn-complete',
          session_id: 'session-1',
          turn_id: 'turn-1',
          context: {
            projectDir,
          },
        },
        sdk
      );

      expect(sdk.tmux.sendKeys).not.toHaveBeenCalled();
      expect(sendTmuxSubmitSequence).not.toHaveBeenCalled();
      expect(sdk.log.warn).toHaveBeenCalledWith(
        'turn_end_skipped_team_worker',
        expect.objectContaining({
          session_id: 'session-1',
          turn_id: 'turn-1',
        })
      );
    } finally {
      if (originalTeamWorker === undefined) {
        delete process.env.OMX_TEAM_WORKER;
      } else {
        process.env.OMX_TEAM_WORKER = originalTeamWorker;
      }
    }
  });

  it('skips turn-end reminder and clears pending scopes when work-complete file exists for current turn', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);
    writeFileSync(
      join(projectDir, '.context', 'config.jsonc'),
      JSON.stringify({
        omx: {
          turnEnd: {
            strategy: 'turn-complete-sendkeys',
          },
        },
        knowledge: {
          sources: ['AGENTS.md'],
        },
      }),
      'utf-8'
    );
    writeFileSync(
      join(projectDir, '.context', '.work-complete'),
      'session_id=session-1\nturn_id=turn-1\n',
      'utf-8'
    );

    const sdk = {
      tmux: {
        sendKeys: vi.fn(),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockImplementation((key: string) => {
          if (key === 'turn_end_pending_followup_scopes') {
            return Promise.resolve({
              'session:session-1': {
                sourceTurnId: 'turn-0',
                createdAt: 123,
              },
            });
          }
          return Promise.resolve(undefined);
        }),
        write: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-1',
        turn_id: 'turn-1',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(sdk.tmux.sendKeys).not.toHaveBeenCalled();
    expect(sendTmuxSubmitSequence).not.toHaveBeenCalled();
    expect(sdk.state.write).toHaveBeenCalledWith('turn_end_pending_followup_scopes', {});
    expect(sdk.log.info).toHaveBeenCalledWith(
      'turn_end_skipped_work_complete',
      expect.objectContaining({
        session_id: 'session-1',
        turn_id: 'turn-1',
      })
    );
    expect(existsSync(join(projectDir, '.context', '.work-complete'))).toBe(true);
  });

  it('clears work-complete file and pending scopes when work-complete file is for a previous turn', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);
    writeFileSync(
      join(projectDir, '.context', 'config.jsonc'),
      JSON.stringify({
        prompts: {
          turnEnd: 'prompts/turn-end.md',
        },
        omx: {
          turnEnd: {
            strategy: 'turn-complete-sendkeys',
          },
        },
        knowledge: {
          sources: ['AGENTS.md'],
        },
      }),
      'utf-8'
    );
    writeFileSync(
      join(projectDir, '.context', '.work-complete'),
      'session_id=session-1\nturn_id=turn-old\n',
      'utf-8'
    );

    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%10',
          paneId: '%10',
        }),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockImplementation((key: string) => {
          if (key === 'turn_end_pending_followup_scopes') {
            return Promise.resolve({
              'session:session-1': {
                sourceTurnId: 'turn-0',
                createdAt: 123,
              },
            });
          }
          return Promise.resolve(undefined);
        }),
        write: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-1',
        turn_id: 'turn-new',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(existsSync(join(projectDir, '.context', '.work-complete'))).toBe(false);
    expect(sdk.state.write).toHaveBeenCalledWith('turn_end_pending_followup_scopes', {});
    expect(sdk.log.info).toHaveBeenCalledWith(
      'turn_end_work_complete_cleared',
      expect.objectContaining({
        session_id: 'session-1',
        turn_id: 'turn-new',
        cleared_turn_id: 'turn-old',
      })
    );
    expect(sdk.tmux.sendKeys).toHaveBeenCalledTimes(1);
  });

  it('ignores work-complete file if session_id does not match', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);
    writeFileSync(
      join(projectDir, '.context', 'config.jsonc'),
      JSON.stringify({
        prompts: {
          turnEnd: 'prompts/turn-end.md',
        },
        omx: {
          turnEnd: {
            strategy: 'turn-complete-sendkeys',
          },
        },
        knowledge: {
          sources: ['AGENTS.md'],
        },
      }),
      'utf-8'
    );
    writeFileSync(
      join(projectDir, '.context', '.work-complete'),
      'session_id=session-other\nturn_id=turn-1\n',
      'utf-8'
    );

    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%10',
          paneId: '%10',
        }),
      },
      log: {
        info: vi.fn(),
      },
      state: {
        read: vi.fn().mockResolvedValue(undefined),
        write: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-1',
        turn_id: 'turn-1',
        context: {
          projectDir,
        },
      },
      sdk
    );

    expect(existsSync(join(projectDir, '.context', '.work-complete'))).toBe(true);
    expect(sdk.tmux.sendKeys).toHaveBeenCalledTimes(1);
  });

  it('fails safely when extra submit sequence fails', async () => {
    vi.mocked(sendTmuxSubmitSequence).mockResolvedValue({
      ok: false,
      attempts: 2,
      error: 'submit failed',
    });

    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      tmux: {
        sendKeys: vi.fn().mockResolvedValue({
          ok: true,
          reason: 'ok',
          target: '%12',
          paneId: '%12',
        }),
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      state: {
        read: vi.fn().mockResolvedValue(undefined),
        write: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'turn-complete',
        session_id: 'session-submit-fail',
        turn_id: 'turn-submit-fail',
        context: {
          projectDir,
          session_name: 'leader',
        },
      },
      sdk
    );

    expect(sdk.state.write).not.toHaveBeenCalled();
    expect(sdk.log.warn).toHaveBeenCalledWith(
      'turn_end_sendkeys_failed',
      expect.objectContaining({
        reason: 'submit_sequence_failed',
        target: '%12',
        submit_attempts: 2,
      })
    );
  });
});
