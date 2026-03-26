import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { pruneStaleMockMcpServer, setCodexConfigPath } from './codex-settings.js';

let tmpDir: string | undefined;

function setupTmpCodexConfig(content: string): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'codex-settings-test-'));
  const configPath = join(tmpDir, 'config.toml');
  writeFileSync(configPath, content, 'utf8');
  setCodexConfigPath(configPath);
  return configPath;
}

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('pruneStaleMockMcpServer', () => {
  it('removes mock-mcp when it points to a missing absolute file', () => {
    const configPath = setupTmpCodexConfig(`
[mcp_servers.mock-mcp]
command = "bun"
args = ["/tmp/does-not-exist/mock-mcp.js"]
enabled = true

[mcp_servers.context-mcp]
command = "bun"
args = ["/tmp/context-mcp.js"]
enabled = true
`);

    expect(pruneStaleMockMcpServer()).toBe(true);
    expect(readFileSync(configPath, 'utf8')).not.toContain('[mcp_servers.mock-mcp]');
    expect(readFileSync(configPath, 'utf8')).toContain('[mcp_servers.context-mcp]');
  });

  it('keeps mock-mcp when its target file exists', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'codex-settings-test-'));
    const serverPath = join(tmpDir, 'mock-mcp.js');
    const configPath = join(tmpDir, 'config.toml');
    writeFileSync(serverPath, 'export {};', 'utf8');
    writeFileSync(
      configPath,
      `
[mcp_servers.mock-mcp]
command = "bun"
args = ["${serverPath}"]
enabled = true
`,
      'utf8'
    );
    setCodexConfigPath(configPath);

    expect(pruneStaleMockMcpServer()).toBe(false);
    expect(readFileSync(configPath, 'utf8')).toContain('[mcp_servers.mock-mcp]');
  });

  it('keeps other MCP servers even when their target file is missing', () => {
    const configPath = setupTmpCodexConfig(`
[mcp_servers.other-server]
command = "bun"
args = ["/tmp/does-not-exist/other.js"]
enabled = true
`);

    expect(pruneStaleMockMcpServer()).toBe(false);
    expect(readFileSync(configPath, 'utf8')).toContain('[mcp_servers.other-server]');
  });
});
