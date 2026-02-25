import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import type { KnowledgeEntry } from '../types';
import { LIMITS } from '../constants';

function extractSummary(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const firstNonEmpty = content.split('\n').find((line) => line.trim().length > 0);
    if (!firstNonEmpty) return '';
    return firstNonEmpty.trim().slice(0, LIMITS.maxSummaryLength);
  } catch {
    return '';
  }
}

function scanDir(dir: string, projectDir: string, depth: number, entries: KnowledgeEntry[]): void {
  if (depth > LIMITS.maxScanDepth) return;
  if (entries.length >= LIMITS.maxIndexEntries) return;
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      if (entries.length >= LIMITS.maxIndexEntries) break;
      const fullPath = join(dir, item);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath, projectDir, depth + 1, entries);
        } else if (stat.isFile() && extname(item) === '.md') {
          entries.push({
            filename: relative(projectDir, fullPath),
            summary: extractSummary(fullPath),
          });
        }
      } catch {
        /* skip inaccessible */
      }
    }
  } catch {
    /* skip inaccessible dir */
  }
}

export function buildKnowledgeIndex(projectDir: string, sources: string[]): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  for (const source of sources) {
    if (entries.length >= LIMITS.maxIndexEntries) break;
    const fullPath = join(projectDir, source);
    if (!existsSync(fullPath)) continue;
    try {
      const stat = statSync(fullPath);
      if (stat.isFile() && extname(source) === '.md') {
        entries.push({
          filename: source,
          summary: extractSummary(fullPath),
        });
      } else if (stat.isDirectory()) {
        scanDir(fullPath, projectDir, 1, entries);
      }
    } catch {
      /* skip */
    }
  }
  return entries;
}

export function formatKnowledgeIndex(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return '';
  const lines = ['## Available Knowledge', ''];
  for (const entry of entries) {
    lines.push(`- ${entry.filename}${entry.summary ? ` — ${entry.summary}` : ''}`);
  }
  return lines.join('\n');
}
