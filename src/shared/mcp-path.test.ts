import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolveMcpPath } from './mcp-path';

describe('resolveMcpPath', () => {
  it('returns a path that actually exists', () => {
    const mcpPath = resolveMcpPath();
    expect(existsSync(mcpPath)).toBe(true);
  });

  it('returns a path ending with mcp.js or mcp.ts', () => {
    const mcpPath = resolveMcpPath();
    expect(mcpPath.endsWith('mcp.js') || mcpPath.endsWith('mcp.ts')).toBe(true);
  });
});
