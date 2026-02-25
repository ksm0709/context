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
