import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import type { KnowledgeEntry, DomainEntry, KnowledgeMode, KnowledgeIndex } from '../types';
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

function countMdFiles(dir: string, indexFilename: string): number {
  try {
    const items = readdirSync(dir);
    return items.filter(
      (item) =>
        extname(item) === '.md' && item !== indexFilename && statSync(join(dir, item)).isFile()
    ).length;
  } catch {
    return 0;
  }
}

function scanDomainsRecursive(
  baseDir: string,
  projectDir: string,
  indexFilename: string,
  currentDepth: number,
  maxDepth: number,
  results: DomainEntry[]
): void {
  if (currentDepth > maxDepth) return;
  try {
    const items = readdirSync(baseDir);
    for (const item of items) {
      const fullPath = join(baseDir, item);
      try {
        if (!statSync(fullPath).isDirectory()) continue;
        const indexPath = join(fullPath, indexFilename);
        if (existsSync(indexPath) && statSync(indexPath).isFile()) {
          const rawContent = readFileSync(indexPath, 'utf-8');
          const indexContent = rawContent.slice(0, LIMITS.maxIndexFileSize);
          results.push({
            domain: item,
            path: relative(projectDir, fullPath),
            indexContent,
            noteCount: countMdFiles(fullPath, indexFilename),
          });
        }
        // recurse deeper regardless of whether this dir had INDEX.md
        scanDomainsRecursive(
          fullPath,
          projectDir,
          indexFilename,
          currentDepth + 1,
          maxDepth,
          results
        );
      } catch {
        /* skip inaccessible */
      }
    }
  } catch {
    /* skip inaccessible dir */
  }
}

export function scanDomains(
  projectDir: string,
  knowledgeDir: string,
  indexFilename: string,
  maxDepth: number
): DomainEntry[] {
  const baseDir = join(projectDir, knowledgeDir);
  if (!existsSync(baseDir)) return [];
  const results: DomainEntry[] = [];
  scanDomainsRecursive(baseDir, projectDir, indexFilename, 1, maxDepth, results);
  return results;
}

export function detectKnowledgeMode(
  projectDir: string,
  knowledgeDir: string,
  indexFilename: string,
  configMode: KnowledgeMode
): KnowledgeMode {
  if (configMode !== 'auto') return configMode;
  const domains = scanDomains(projectDir, knowledgeDir, indexFilename, 1);
  return domains.length > 0 ? 'domain' : 'flat';
}

export function formatDomainIndex(index: KnowledgeIndex): string {
  const hasDomains = index.domains.length > 0;
  const hasFiles = index.individualFiles.length > 0;
  if (!hasDomains && !hasFiles) return '';

  const lines = ['## Available Knowledge', ''];

  if (hasDomains) {
    lines.push('### Domains', '');
    for (const domain of index.domains) {
      lines.push(`#### ${domain.path}/ (${domain.noteCount} notes)`, '');
      lines.push(domain.indexContent, '');
    }
  }

  if (hasFiles) {
    if (hasDomains) {
      lines.push('### Individual Files', '');
    }
    for (const file of index.individualFiles) {
      lines.push(`- ${file.filename}${file.summary ? ` — ${file.summary}` : ''}`);
    }
  }

  return lines.join('\n');
}

function collectRootFiles(
  projectDir: string,
  knowledgeDir: string,
  indexFilename: string
): KnowledgeEntry[] {
  const baseDir = join(projectDir, knowledgeDir);
  if (!existsSync(baseDir)) return [];
  const entries: KnowledgeEntry[] = [];
  try {
    const items = readdirSync(baseDir);
    for (const item of items) {
      const fullPath = join(baseDir, item);
      try {
        const stat = statSync(fullPath);
        if (stat.isFile() && extname(item) === '.md' && item !== indexFilename) {
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
  return entries;
}

export function buildKnowledgeIndexV2(
  projectDir: string,
  knowledgeConfig: {
    dir?: string;
    sources: string[];
    mode?: KnowledgeMode;
    indexFilename?: string;
    maxDomainDepth?: number;
  }
): KnowledgeIndex {
  const dir = knowledgeConfig.dir ?? 'docs';
  const indexFilename = knowledgeConfig.indexFilename ?? 'INDEX.md';
  const maxDepth = knowledgeConfig.maxDomainDepth ?? 2;
  const configMode = knowledgeConfig.mode ?? 'auto';

  const mode = detectKnowledgeMode(projectDir, dir, indexFilename, configMode);

  if (mode === 'flat') {
    const allSources = [dir, ...knowledgeConfig.sources].filter(Boolean);
    const entries = buildKnowledgeIndex(projectDir, allSources);
    return { mode: 'flat', domains: [], individualFiles: entries };
  }

  // Domain mode
  const domains = scanDomains(projectDir, dir, indexFilename, maxDepth);
  const rootFiles = collectRootFiles(projectDir, dir, indexFilename);

  // Also collect explicit sources (AGENTS.md, etc.)
  const sourcesEntries: KnowledgeEntry[] = [];
  for (const source of knowledgeConfig.sources) {
    const fullPath = join(projectDir, source);
    if (!existsSync(fullPath)) continue;
    try {
      const stat = statSync(fullPath);
      if (stat.isFile() && extname(source) === '.md') {
        sourcesEntries.push({
          filename: source,
          summary: extractSummary(fullPath),
        });
      }
    } catch {
      /* skip */
    }
  }

  const individualFiles = [...rootFiles, ...sourcesEntries];
  return { mode: 'domain', domains, individualFiles };
}
