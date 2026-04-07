import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { resolveMcpPath } from './mcp-path';

let originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe('resolveMcpPath', () => {
  it('returns a path that actually exists', () => {
    const mcpPath = resolveMcpPath();
    expect(existsSync(mcpPath)).toBe(true);
  });

  it('returns a path ending with mcp.js or mcp.ts', () => {
    const mcpPath = resolveMcpPath();
    expect(mcpPath.endsWith('mcp.js') || mcpPath.endsWith('mcp.ts')).toBe(true);
  });

  it('prefers the active workspace dist in a git worktree-style checkout', () => {
    const tmpDir = join(
      tmpdir(),
      `mcp-path-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(join(tmpDir, 'dist'), { recursive: true });
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: '@ksm0709/context', version: '9.9.9' }),
      'utf8'
    );
    writeFileSync(join(tmpDir, 'dist', 'mcp.js'), '// workspace build', 'utf8');

    process.chdir(tmpDir);

    expect(resolveMcpPath()).toBe(join(tmpDir, 'dist', 'mcp.js'));

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
