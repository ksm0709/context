import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const STALE_MOCK_MCP_SERVER_NAME = 'mock-mcp';

let codexConfigPath = join(homedir(), '.codex', 'config.toml');

export function getCodexConfigPath(): string {
  return codexConfigPath;
}

export function setCodexConfigPath(path: string): void {
  codexConfigPath = path;
}

function findMcpServerBlockRange(
  lines: string[],
  serverName: string
): { start: number; end: number } | null {
  const header = `[mcp_servers.${serverName}]`;
  const start = lines.findIndex((line) => line.trim() === header);

  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('[')) {
      end = index;
      break;
    }
  }

  return { start, end };
}

function resolveFirstArgPath(blockLines: string[]): string | null {
  for (const line of blockLines) {
    const match = line.match(/^\s*args\s*=\s*\[\s*["']([^"']+)["']/);
    if (!match) {
      continue;
    }

    return match[1];
  }

  return null;
}

export function pruneStaleMockMcpServer(): boolean {
  if (!existsSync(codexConfigPath)) {
    return false;
  }

  const content = readFileSync(codexConfigPath, 'utf8');
  const lines = content.split('\n');
  const blockRange = findMcpServerBlockRange(lines, STALE_MOCK_MCP_SERVER_NAME);

  if (!blockRange) {
    return false;
  }

  const blockLines = lines.slice(blockRange.start, blockRange.end);
  const firstArgPath = resolveFirstArgPath(blockLines);

  if (!firstArgPath || !isAbsolute(firstArgPath) || existsSync(firstArgPath)) {
    return false;
  }

  const nextLines = [...lines.slice(0, blockRange.start), ...lines.slice(blockRange.end)];
  writeFileSync(codexConfigPath, nextLines.join('\n'), 'utf8');

  return true;
}
