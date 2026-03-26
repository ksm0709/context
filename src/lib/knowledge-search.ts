import * as fs from 'fs/promises';
import * as path from 'path';

const SEARCH_DIRECTORIES: string[] = ['docs', '.context'];
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const HEADING_REGEX = /^#\s+(.+)$/m;
const WIKI_LINK_REGEX = /\[\[([^[\]]+?)\]\]/g;
const SNIPPET_LENGTH = 160;
const KNOWLEDGE_READ_MAX_LENGTH = 32 * 1024;
const RELATED_NOTES_SECTION_MAX_LENGTH = 6 * 1024;
const STOP_WORDS: Set<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'what',
  'when',
  'where',
  'which',
  'with',
  '가',
  '는',
  '도',
  '를',
  '에',
  '와',
  '을',
  '의',
  '이',
  '좀',
  '할',
  '때',
]);

export interface KnowledgeNote {
  body: string;
  content: string;
  description: string;
  file: string;
  links: string[];
  pathStem: string;
  tags: string[];
  title: string;
}

export interface KnowledgeSearchMatch {
  file: string;
  title: string;
  description: string;
  tags: string[];
  score: number;
  snippet: string;
  matchReasons: string[];
}

interface ParsedFrontmatter {
  body: string;
  metadata: Record<string, string | string[]>;
}

interface ResolvedKnowledgeLinks {
  resolved: KnowledgeNote[];
  unresolved: string[];
}

export function normalizeKnowledgePath(filePath: string): string {
  const normalizedPath = path.normalize(filePath);

  if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
    throw new Error('Invalid path: Directory traversal is not allowed');
  }

  const relativePath = toPosixPath(normalizedPath);
  if (!SEARCH_DIRECTORIES.some((dir) => relativePath.startsWith(`${dir}/`))) {
    throw new Error('Invalid path: Only files in docs/ or .context/ are allowed');
  }

  return relativePath;
}

export async function loadKnowledgeNotes(rootDir: string): Promise<KnowledgeNote[]> {
  const notes: KnowledgeNote[] = [];

  for (const dir of SEARCH_DIRECTORIES) {
    const fullDirPath = path.resolve(rootDir, dir);

    try {
      const files = await fs.readdir(fullDirPath, { recursive: true });

      for (const file of files) {
        if (typeof file !== 'string' || !file.endsWith('.md')) {
          continue;
        }

        const fullPath = path.join(fullDirPath, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = toPosixPath(path.relative(rootDir, fullPath));
        notes.push(parseKnowledgeNote(relativePath, content));
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return notes.sort((left, right) => left.file.localeCompare(right.file));
}

export function buildSearchKnowledgeResponse(results: KnowledgeSearchMatch[]): string {
  if (results.length === 0) {
    return 'No matches found.';
  }

  return [
    ...results.map((result, index) =>
      [
        `Result ${index + 1}`,
        `Path: ${result.file}`,
        `Title: ${result.title}`,
        `Description: ${result.description || '(none)'}`,
        `Tags: ${result.tags.length > 0 ? result.tags.join(', ') : '(none)'}`,
        `Score: ${result.score}`,
        `Match reasons: ${
          result.matchReasons.length > 0 ? result.matchReasons.join(', ') : '(general overlap)'
        }`,
        `Snippet: ${result.snippet}`,
      ].join('\n')
    ),
    'Open a relevant note with read_knowledge to inspect the full content and linked-note metadata.',
  ].join('\n\n');
}

export function formatRelatedNotesSection(relatedNotes: ResolvedKnowledgeLinks): string {
  if (relatedNotes.resolved.length === 0 && relatedNotes.unresolved.length === 0) {
    return '';
  }

  const lines: string[] = ['## Related Notes', ''];

  if (relatedNotes.resolved.length > 0) {
    for (const note of relatedNotes.resolved) {
      lines.push(`- Title: ${note.title}`);
      lines.push(`  Path: ${note.file}`);
      lines.push(`  Description: ${note.description || '(none)'}`);
      lines.push(`  Tags: ${note.tags.length > 0 ? note.tags.join(', ') : '(none)'}`);
    }
    lines.push('');
  }

  if (relatedNotes.unresolved.length > 0) {
    lines.push(`Unresolved links: ${relatedNotes.unresolved.join(', ')}`);
    lines.push('');
  }

  lines.push(
    'If one of these related notes looks relevant, open it with `read_knowledge` to continue exploring.'
  );

  return lines.join('\n').trim();
}

export function buildReadKnowledgeResponse(content: string, relatedNotesSection: string): string {
  if (!relatedNotesSection) {
    return content.length > KNOWLEDGE_READ_MAX_LENGTH
      ? `${content.substring(0, KNOWLEDGE_READ_MAX_LENGTH)}\n\n... (content truncated due to size limit)`
      : content;
  }

  const truncatedRelatedSection =
    relatedNotesSection.length > RELATED_NOTES_SECTION_MAX_LENGTH
      ? `${relatedNotesSection.slice(0, RELATED_NOTES_SECTION_MAX_LENGTH)}\n... (related notes truncated)`
      : relatedNotesSection;
  const reservedLength = truncatedRelatedSection.length + 2;
  const mainBudget = Math.max(0, KNOWLEDGE_READ_MAX_LENGTH - reservedLength);
  const truncatedMainContent =
    content.length > mainBudget
      ? `${content.substring(0, mainBudget)}\n\n... (content truncated due to size limit)`
      : content;

  return `${truncatedMainContent}\n\n${truncatedRelatedSection}`;
}

export function parseKnowledgeNote(file: string, content: string): KnowledgeNote {
  const { body, metadata } = parseFrontmatter(content);
  const title = resolveTitle(file, body, metadata);
  const description = resolveDescription(body, metadata);
  const tags = resolveTags(metadata);

  return {
    body,
    content,
    description,
    file,
    links: extractWikiLinks(content),
    pathStem: normalizeSearchText(stripExtension(file)),
    tags,
    title,
  };
}

export function searchKnowledgeNotes(
  notes: KnowledgeNote[],
  query: string,
  limit: number
): KnowledgeSearchMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeQuery(query);

  if (normalizedQuery.length === 0 && queryTokens.length === 0) {
    return [];
  }

  return notes
    .map((note) => scoreKnowledgeNote(note, normalizedQuery, queryTokens))
    .filter((match) => match.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.file.localeCompare(right.file);
    })
    .slice(0, limit);
}

export function resolveRelatedKnowledgeLinks(
  notes: KnowledgeNote[],
  currentFile: string,
  links: string[]
): ResolvedKnowledgeLinks {
  const lookup = new Map<string, KnowledgeNote>();

  for (const note of notes) {
    const keys = [normalizeSearchText(note.title), note.pathStem];

    for (const key of keys) {
      if (!key || lookup.has(key)) {
        continue;
      }

      lookup.set(key, note);
    }
  }

  const resolved: KnowledgeNote[] = [];
  const unresolved: string[] = [];
  const seenFiles = new Set<string>();

  for (const rawLink of links) {
    const normalizedLink = normalizeSearchText(rawLink);
    const note = lookup.get(normalizedLink);

    if (!note || note.file === currentFile || seenFiles.has(note.file)) {
      if (!note) {
        unresolved.push(rawLink);
      }
      continue;
    }

    resolved.push(note);
    seenFiles.add(note.file);
  }

  return { resolved, unresolved };
}

function scoreKnowledgeNote(
  note: KnowledgeNote,
  normalizedQuery: string,
  queryTokens: string[]
): KnowledgeSearchMatch {
  const matchReasons: string[] = [];
  let score = 0;

  score += scoreTextField({
    exactPhraseWeight: 80,
    label: 'title',
    matchReasons,
    queryTokens,
    text: note.title,
    tokenWeight: 24,
    normalizedQuery,
  });
  score += scoreTags(note.tags, queryTokens, matchReasons);
  score += scoreTextField({
    exactPhraseWeight: 40,
    label: 'description',
    matchReasons,
    queryTokens,
    text: note.description,
    tokenWeight: 14,
    normalizedQuery,
  });
  score += scoreTextField({
    exactPhraseWeight: 20,
    label: 'body',
    matchReasons,
    queryTokens,
    text: note.body,
    tokenWeight: 6,
    normalizedQuery,
  });
  score += scoreTextField({
    exactPhraseWeight: 12,
    label: 'path',
    matchReasons,
    queryTokens,
    text: note.file,
    tokenWeight: 4,
    normalizedQuery,
  });

  return {
    description: note.description,
    file: note.file,
    matchReasons,
    score,
    snippet: buildSnippet(note, queryTokens),
    tags: note.tags,
    title: note.title,
  };
}

function scoreTextField(params: {
  exactPhraseWeight: number;
  label: string;
  matchReasons: string[];
  normalizedQuery: string;
  queryTokens: string[];
  text: string;
  tokenWeight: number;
}): number {
  const normalizedText = normalizeSearchText(params.text);

  if (!normalizedText) {
    return 0;
  }

  const tokenSet = new Set(tokenizeQuery(params.text));
  const matchedTokenCount = params.queryTokens.filter((token) => tokenSet.has(token)).length;
  let score = matchedTokenCount * params.tokenWeight;

  if (matchedTokenCount > 0) {
    params.matchReasons.push(`${params.label}:${matchedTokenCount}`);
  }

  if (params.normalizedQuery && normalizedText.includes(params.normalizedQuery)) {
    score += params.exactPhraseWeight;
    params.matchReasons.push(`${params.label}:phrase`);
  }

  return score;
}

function scoreTags(tags: string[], queryTokens: string[], matchReasons: string[]): number {
  const normalizedTags = tags.map((tag) => normalizeSearchText(tag)).filter(Boolean);
  let score = 0;
  let matched = 0;

  for (const token of queryTokens) {
    const hasMatch = normalizedTags.some((tag) => tag === token || tag.includes(token));
    if (!hasMatch) {
      continue;
    }

    matched += 1;
    score += 20;
  }

  if (matched > 0) {
    matchReasons.push(`tags:${matched}`);
  }

  return score;
}

function buildSnippet(note: KnowledgeNote, queryTokens: string[]): string {
  const preferredSources = [note.description, note.body, note.title];

  for (const source of preferredSources) {
    const snippet = buildSnippetFromText(source, queryTokens);
    if (snippet) {
      return snippet;
    }
  }

  return truncateInlineText(note.title || note.file, SNIPPET_LENGTH);
}

function buildSnippetFromText(text: string, queryTokens: string[]): string {
  const inlineText = text.replace(/\s+/g, ' ').trim();
  if (!inlineText) {
    return '';
  }

  const lowerText = inlineText.toLowerCase();
  let firstIndex = Number.POSITIVE_INFINITY;

  for (const token of queryTokens) {
    const matchIndex = lowerText.indexOf(token.toLowerCase());
    if (matchIndex !== -1 && matchIndex < firstIndex) {
      firstIndex = matchIndex;
    }
  }

  if (!Number.isFinite(firstIndex)) {
    return truncateInlineText(inlineText, SNIPPET_LENGTH);
  }

  const start = Math.max(0, firstIndex - Math.floor(SNIPPET_LENGTH / 3));
  const end = Math.min(inlineText.length, start + SNIPPET_LENGTH);
  let snippet = inlineText.slice(start, end);

  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < inlineText.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}

function truncateInlineText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER_REGEX.exec(content);

  if (!match) {
    return {
      body: content,
      metadata: {},
    };
  }

  return {
    body: content.slice(match[0].length),
    metadata: parseFrontmatterBlock(match[1]),
  };
}

function parseFrontmatterBlock(block: string): Record<string, string | string[]> {
  const metadata: Record<string, string | string[]> = {};
  const lines = block.split(/\r?\n/);
  let currentArrayKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (currentArrayKey && /^\s*-\s+/.test(line)) {
      const arrayValue = normalizeScalarValue(trimmed.replace(/^-+\s*/, ''));
      const existing = metadata[currentArrayKey];

      if (Array.isArray(existing)) {
        existing.push(arrayValue);
      } else {
        metadata[currentArrayKey] = [arrayValue];
      }
      continue;
    }

    currentArrayKey = null;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (!value) {
      currentArrayKey = key;
      metadata[key] = [];
      continue;
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      metadata[key] = value
        .slice(1, -1)
        .split(',')
        .map((item) => normalizeScalarValue(item))
        .filter(Boolean);
      continue;
    }

    metadata[key] = normalizeScalarValue(value);
  }

  return metadata;
}

function resolveTitle(
  file: string,
  body: string,
  metadata: Record<string, string | string[]>
): string {
  const frontmatterTitle = getMetadataString(metadata, 'title');
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const headingMatch = HEADING_REGEX.exec(body);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  return humanizeSlug(path.basename(file, '.md'));
}

function resolveDescription(body: string, metadata: Record<string, string | string[]>): string {
  const frontmatterDescription =
    getMetadataString(metadata, 'description') ?? getMetadataString(metadata, 'summary');
  if (frontmatterDescription) {
    return frontmatterDescription;
  }

  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const paragraph = lines.find((line) => !line.startsWith('- ') && !line.startsWith('* '));
  return paragraph ? truncateInlineText(paragraph, 200) : '';
}

function resolveTags(metadata: Record<string, string | string[]>): string[] {
  const tags = metadata.tags;

  if (Array.isArray(tags)) {
    return tags.map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function getMetadataString(
  metadata: Record<string, string | string[]>,
  key: string
): string | null {
  const value = metadata[key];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
}

function normalizeScalarValue(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function extractWikiLinks(content: string): string[] {
  const links = new Set<string>();

  for (const match of content.matchAll(WIKI_LINK_REGEX)) {
    const rawTarget = match[1].split('|')[0].split('#')[0].trim();
    if (rawTarget) {
      links.add(rawTarget);
    }
  }

  return [...links];
}

function tokenizeQuery(text: string): string[] {
  const rawTokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  const filteredTokens = rawTokens.filter((token) => !STOP_WORDS.has(token));

  return [...new Set(filteredTokens.length > 0 ? filteredTokens : rawTokens)];
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function humanizeSlug(slug: string): string {
  const words = slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word));

  return words.join(' ') || slug;
}

function stripExtension(file: string): string {
  return file.endsWith('.md') ? file.slice(0, -3) : file;
}
