import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const START_MARKER = '<!-- context:start -->';
const END_MARKER = '<!-- context:end -->';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `global-instructions-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe('getGlobalInstructionPath', () => {
  it('returns ~/.claude/CLAUDE.md for claude tool', async () => {
    const { getGlobalInstructionPath } = await import('./global-instructions.js');
    const path = getGlobalInstructionPath('claude');
    expect(path).toMatch(/\.claude\/CLAUDE\.md$/);
  });

  it('returns ~/.codex/instructions.md for codex tool', async () => {
    const { getGlobalInstructionPath } = await import('./global-instructions.js');
    const path = getGlobalInstructionPath('codex');
    expect(path).toMatch(/\.codex\/instructions\.md$/);
  });
});

describe('injectIntoGlobalInstructions', () => {
  it('creates the instruction file with markers when it does not exist', async () => {
    const tempDir = createTempDir();
    const fakePath = join(tempDir, '.claude', 'CLAUDE.md');

    // Use injectIntoAgentsMd directly to test the mechanism with a custom path
    const { injectIntoAgentsMd } = await import('./agents-md.js');
    injectIntoAgentsMd(fakePath, 'Test workflow context');

    expect(existsSync(fakePath)).toBe(true);
    const content = readFileSync(fakePath, 'utf-8');
    expect(content).toBe(`${START_MARKER}\nTest workflow context\n${END_MARKER}\n`);
  });

  it('preserves existing content in the global instruction file', async () => {
    const tempDir = createTempDir();
    const fakePath = join(tempDir, '.claude', 'CLAUDE.md');
    mkdirSync(join(tempDir, '.claude'), { recursive: true });
    writeFileSync(fakePath, '# My Global Settings\n\nKeep this.\n', 'utf-8');

    const { injectIntoAgentsMd } = await import('./agents-md.js');
    injectIntoAgentsMd(fakePath, 'Knowledge context');

    const content = readFileSync(fakePath, 'utf-8');
    expect(content).toContain('# My Global Settings');
    expect(content).toContain('Keep this.');
    expect(content).toContain(START_MARKER);
    expect(content).toContain('Knowledge context');
    expect(content).toContain(END_MARKER);
  });

  it('updates existing marker block without duplicating', async () => {
    const tempDir = createTempDir();
    const fakePath = join(tempDir, '.codex', 'instructions.md');
    mkdirSync(join(tempDir, '.codex'), { recursive: true });
    writeFileSync(
      fakePath,
      `# Codex Instructions\n\n${START_MARKER}\nOld context\n${END_MARKER}\n\n## My Rules\n`,
      'utf-8'
    );

    const { injectIntoAgentsMd } = await import('./agents-md.js');
    injectIntoAgentsMd(fakePath, 'New context');

    const content = readFileSync(fakePath, 'utf-8');
    expect(content).toContain('# Codex Instructions');
    expect(content).toContain('New context');
    expect(content).toContain('## My Rules');
    expect(content).not.toContain('Old context');
    expect(content.match(/<!-- context:start -->/g)).toHaveLength(1);
  });
});
