import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onHookEvent } from './index.js';

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
    expect(content).toContain('## OMX Knowledge Context');
    expect(content).toContain('Read from docs first.');
    expect(content).toContain('## Available Knowledge');
    expect(content).toContain('docs/architecture.md');
    expect(content).toContain('AGENTS.md');
    expect(sdk.log.info).toHaveBeenCalledTimes(1);
  });

  it('ignores non-session-start events', async () => {
    const projectDir = createTempProjectDir();
    setupProject(projectDir);

    const sdk = {
      log: {
        info: vi.fn(),
      },
    };

    await onHookEvent(
      {
        event: 'message',
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
