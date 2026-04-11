import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';

const STALE_MOCK_MCP_SERVER_NAME = 'mock-mcp';
const CONTEXT_MCP_BEGIN_MARKER = '# BEGIN CONTEXT MANAGED MCP REGISTRY';
const CONTEXT_MCP_END_MARKER = '# END CONTEXT MANAGED MCP REGISTRY';

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

function upsertFeatureFlag(content: string, key: string, value: string): string {
  const lines = content.split('\n');
  const sectionHeader = '[features]';
  const start = lines.findIndex((line) => line.trim() === sectionHeader);

  if (start === -1) {
    const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
    return `${content}${suffix}\n[features]\n${key} = ${value}\n`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('[')) {
      end = index;
      break;
    }
  }

  const keyIndex = lines.findIndex(
    (line, index) => index > start && index < end && line.trim().startsWith(`${key} =`)
  );
  if (keyIndex !== -1) {
    lines[keyIndex] = `${key} = ${value}`;
    return lines.join('\n');
  }

  lines.splice(end, 0, `${key} = ${value}`);
  return lines.join('\n');
}

function renderManagedContextMcpBlock(command: string, mcpPath: string): string {
  return [
    CONTEXT_MCP_BEGIN_MARKER,
    '',
    '[mcp_servers.context-mcp]',
    `command = ${JSON.stringify(command)}`,
    `args = [${JSON.stringify(mcpPath)}]`,
    '',
    '[mcp_servers.context-mcp.tools.submit_turn_complete]',
    'approval_mode = "approve"',
    '',
    CONTEXT_MCP_END_MARKER,
  ].join('\n');
}

export function ensureContextMcpRegistered(command: string, mcpPath: string): boolean {
  const current = existsSync(codexConfigPath) ? readFileSync(codexConfigPath, 'utf8') : '';
  const normalized = upsertFeatureFlag(current, 'codex_hooks', 'true');
  const block = renderManagedContextMcpBlock(command, mcpPath);
  const managedSectionPattern =
    /# BEGIN CONTEXT MANAGED MCP REGISTRY[\s\S]*?# END CONTEXT MANAGED MCP REGISTRY/;

  // Strip ALL existing managed blocks before re-inserting
  const stripped = normalized
    .replace(new RegExp(managedSectionPattern.source + '\\n?', 'g'), '')
    .trimEnd();
  const next = managedSectionPattern.test(normalized)
    ? `${stripped}\n\n${block}\n`
    : `${normalized}${normalized.endsWith('\n') || normalized.length === 0 ? '' : '\n'}\n${block}\n`;

  if (next === current) {
    return false;
  }

  mkdirSync(dirname(codexConfigPath), { recursive: true });
  writeFileSync(codexConfigPath, next, 'utf8');
  return true;
}
