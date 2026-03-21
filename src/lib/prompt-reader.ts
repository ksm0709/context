import { readFileSync } from 'node:fs';
import { LIMITS } from '../constants';

export function readPromptFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (content.length > LIMITS.maxPromptFileSize) {
      return content.slice(0, LIMITS.maxPromptFileSize);
    }
    return content;
  } catch {
    return '';
  }
}

export interface PromptVariables {
  knowledgeDir: string;
  sessionId?: string;
  turnId?: string;
}

export function resolvePromptVariables(content: string, vars: PromptVariables): string {
  const normalized = (vars.knowledgeDir || 'docs').replace(/\\/g, '/').replace(/\/+$/, '');
  let resolved = content.replaceAll('{{knowledgeDir}}', normalized);
  resolved = resolved.replaceAll('{{sessionId}}', vars.sessionId ?? '');
  resolved = resolved.replaceAll('{{turnId}}', vars.turnId ?? '');
  return resolved;
}
