import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { resolveMcpPath, getRegistryPaths, ensureMcpRegistered } from './registry';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return {
    ...actual,
    homedir: vi.fn(),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => '/usr/local/bin/bun'),
}));

describe('registry', () => {
  let tmpDir: string;
  let mockHomedir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `omx-registry-test-${Date.now()}`);
    mockHomedir = join(tmpDir, 'home');
    mkdirSync(mockHomedir, { recursive: true });
    vi.mocked(homedir).mockReturnValue(mockHomedir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('resolveMcpPath', () => {
    it('returns a valid path ending with mcp.js or mcp.ts', () => {
      const mcpPath = resolveMcpPath();
      expect(typeof mcpPath).toBe('string');
      expect(mcpPath.endsWith('mcp.js') || mcpPath.endsWith('mcp.ts')).toBe(true);
    });
  });

  describe('getRegistryPaths', () => {
    it('returns the correct registry paths', () => {
      const paths = getRegistryPaths();
      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(join(mockHomedir, '.omx', 'mcp-registry.json'));
      expect(paths[1]).toBe(join(mockHomedir, '.omc', 'mcp-registry.json'));
    });
  });

  describe('ensureMcpRegistered', () => {
    it('creates registry file if it does not exist', () => {
      const targetPath = join(mockHomedir, '.omx', 'mcp-registry.json');
      expect(existsSync(targetPath)).toBe(false);

      const result = ensureMcpRegistered();

      expect(result).toBe(true);
      expect(existsSync(targetPath)).toBe(true);

      const content = JSON.parse(readFileSync(targetPath, 'utf-8'));
      expect(content['context-mcp']).toBeDefined();
      expect(content['context-mcp'].command).toBe('/usr/local/bin/bun');
      expect(content['context-mcp'].enabled).toBe(true);
      expect(Array.isArray(content['context-mcp'].args)).toBe(true);
      expect(content['context-mcp'].args[0]).toBe(resolveMcpPath());
    });

    it('updates existing registry file if context-mcp is missing', () => {
      const targetPath = join(mockHomedir, '.omx', 'mcp-registry.json');
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, JSON.stringify({ other: 'config' }));

      const result = ensureMcpRegistered();

      expect(result).toBe(true);
      const content = JSON.parse(readFileSync(targetPath, 'utf-8'));
      expect(content.other).toBe('config');
      expect(content['context-mcp']).toBeDefined();
    });

    it('updates existing registry file if context-mcp is outdated', () => {
      const targetPath = join(mockHomedir, '.omx', 'mcp-registry.json');
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(
        targetPath,
        JSON.stringify({
          'context-mcp': {
            command: 'node',
            args: ['old-path.js'],
          },
        })
      );

      const result = ensureMcpRegistered();

      expect(result).toBe(true);
      const content = JSON.parse(readFileSync(targetPath, 'utf-8'));
      expect(content['context-mcp'].command).toBe('/usr/local/bin/bun');
      expect(content['context-mcp'].args[0]).toBe(resolveMcpPath());
    });

    it('returns false if registry is already up to date', () => {
      const targetPath = join(mockHomedir, '.omx', 'mcp-registry.json');
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(
        targetPath,
        JSON.stringify({
          'context-mcp': {
            command: '/usr/local/bin/bun',
            args: [resolveMcpPath()],
            enabled: true,
          },
        })
      );

      const result = ensureMcpRegistered();

      expect(result).toBe(false);
    });

    it('cleans up legacy context_mcp entry', () => {
      const targetPath = join(mockHomedir, '.omx', 'mcp-registry.json');
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(
        targetPath,
        JSON.stringify({
          context_mcp: {
            command: 'bun',
            args: [resolveMcpPath()],
          },
        })
      );

      const result = ensureMcpRegistered();

      expect(result).toBe(true);
      const content = JSON.parse(readFileSync(targetPath, 'utf-8'));
      expect(content['context_mcp']).toBeUndefined();
      expect(content['context-mcp']).toBeDefined();
    });

    it('handles invalid JSON gracefully', () => {
      const targetPath = join(mockHomedir, '.omx', 'mcp-registry.json');
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, '{ invalid json }');

      const logs: string[] = [];
      const mockLog = (msg: string) => logs.push(msg);

      const result = ensureMcpRegistered(mockLog);

      expect(result).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toContain('Failed to parse MCP registry');

      const content = JSON.parse(readFileSync(targetPath, 'utf-8'));
      expect(content['context-mcp']).toBeDefined();
    });

    it('uses .omc registry if it exists and .omx does not', () => {
      const omcPath = join(mockHomedir, '.omc', 'mcp-registry.json');
      mkdirSync(dirname(omcPath), { recursive: true });
      writeFileSync(omcPath, JSON.stringify({}));

      const result = ensureMcpRegistered();

      expect(result).toBe(true);
      expect(existsSync(join(mockHomedir, '.omx', 'mcp-registry.json'))).toBe(false);

      const content = JSON.parse(readFileSync(omcPath, 'utf-8'));
      expect(content['context-mcp']).toBeDefined();
    });
  });
});
