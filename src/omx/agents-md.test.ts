import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectIntoAgentsMd } from '../shared/agents-md.js';

const START_MARKER = '<!-- context:start -->';
const END_MARKER = '<!-- context:end -->';

const tempDirs: string[] = [];

function createTempAgentsMdPath(): string {
  const directory = join(
    tmpdir(),
    `agents-md-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  mkdirSync(directory, { recursive: true });
  tempDirs.push(directory);

  return join(directory, 'AGENTS.md');
}

afterEach(() => {
  for (const directory of tempDirs) {
    rmSync(directory, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

describe('injectIntoAgentsMd', () => {
  it('creates AGENTS.md with markers and content when file does not exist', () => {
    const agentsMdPath = createTempAgentsMdPath();

    injectIntoAgentsMd(agentsMdPath, 'Injected content');

    expect(existsSync(agentsMdPath)).toBe(true);
    expect(readFileSync(agentsMdPath, 'utf-8')).toBe(
      `${START_MARKER}\nInjected content\n${END_MARKER}\n`
    );
  });

  it('appends marker block to the end when AGENTS.md has no markers', () => {
    const agentsMdPath = createTempAgentsMdPath();
    writeFileSync(agentsMdPath, '# Existing heading\n\nKeep this section.\n', 'utf-8');

    injectIntoAgentsMd(agentsMdPath, 'Injected content');

    expect(readFileSync(agentsMdPath, 'utf-8')).toBe(
      '# Existing heading\n\nKeep this section.\n\n' +
        `${START_MARKER}\nInjected content\n${END_MARKER}\n`
    );
  });

  it('replaces only the content between markers when marker block already exists', () => {
    const agentsMdPath = createTempAgentsMdPath();
    writeFileSync(
      agentsMdPath,
      '# Existing heading\n\n' +
        `${START_MARKER}\nOld content\n${END_MARKER}\n\n` +
        '## Tail\nPreserve this.\n',
      'utf-8'
    );

    injectIntoAgentsMd(agentsMdPath, 'New content');

    expect(readFileSync(agentsMdPath, 'utf-8')).toBe(
      '# Existing heading\n\n' +
        `${START_MARKER}\nNew content\n${END_MARKER}\n\n` +
        '## Tail\nPreserve this.\n'
    );
  });

  it('is idempotent and does not duplicate marker blocks across repeated calls', () => {
    const agentsMdPath = createTempAgentsMdPath();

    injectIntoAgentsMd(agentsMdPath, 'Injected content');
    injectIntoAgentsMd(agentsMdPath, 'Injected content');

    const content = readFileSync(agentsMdPath, 'utf-8');

    expect(content).toBe(`${START_MARKER}\nInjected content\n${END_MARKER}\n`);
    expect(content.match(/<!-- context:start -->/g)).toHaveLength(1);
    expect(content.match(/<!-- context:end -->/g)).toHaveLength(1);
  });

  it('preserves existing content outside the marker block during updates', () => {
    const agentsMdPath = createTempAgentsMdPath();
    const before = 'Intro line\nSecond intro line\n\n';
    const after = '\n## Existing rules\n- Keep me\n';

    writeFileSync(
      agentsMdPath,
      before + `${START_MARKER}\nOriginal\n${END_MARKER}` + after,
      'utf-8'
    );

    injectIntoAgentsMd(agentsMdPath, 'Replacement');

    expect(readFileSync(agentsMdPath, 'utf-8')).toBe(
      before + `${START_MARKER}\nReplacement\n${END_MARKER}` + after
    );
  });
});
