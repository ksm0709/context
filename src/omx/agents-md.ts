import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const START_MARKER = '<!-- context:start -->';
const END_MARKER = '<!-- context:end -->';

function renderMarkerBlock(content: string, trailingNewline: boolean): string {
  const block = `${START_MARKER}\n${content}\n${END_MARKER}`;

  if (trailingNewline) {
    return `${block}\n`;
  }

  return block;
}

function appendMarkerBlock(existingContent: string, content: string): string {
  if (existingContent.length === 0) {
    return renderMarkerBlock(content, true);
  }

  const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
  return `${existingContent}${separator}${renderMarkerBlock(content, true)}`;
}

function replaceMarkerBlock(existingContent: string, content: string): string {
  const startIndex = existingContent.indexOf(START_MARKER);
  const endIndex = existingContent.indexOf(END_MARKER, startIndex + START_MARKER.length);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return appendMarkerBlock(existingContent, content);
  }

  const before = existingContent.slice(0, startIndex);
  const after = existingContent.slice(endIndex + END_MARKER.length);
  const replacement = renderMarkerBlock(content, false);

  return `${before}${replacement}${after}`;
}

function writeFileAtomically(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, content, 'utf-8');
  renameSync(tempPath, filePath);
}

export function injectIntoAgentsMd(agentsMdPath: string, content: string): void {
  mkdirSync(dirname(agentsMdPath), { recursive: true });

  if (!existsSync(agentsMdPath)) {
    writeFileAtomically(agentsMdPath, renderMarkerBlock(content, true));
    return;
  }

  const existingContent = readFileSync(agentsMdPath, 'utf-8');
  const nextContent =
    existingContent.includes(START_MARKER) && existingContent.includes(END_MARKER)
      ? replaceMarkerBlock(existingContent, content)
      : appendMarkerBlock(existingContent, content);

  writeFileAtomically(agentsMdPath, nextContent);
}
