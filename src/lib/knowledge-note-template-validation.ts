interface MarkdownHeading {
  level: number;
  line: number;
  raw: string;
  text: string;
}

interface TemplateValidationResult {
  errors: string[];
}

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/;
const ADDITIONAL_FORBIDDEN_SNIPPETS: string[] = ['[제목]', '[간단한 설명]', 'TODO'];
const RELATED_NOTES_TITLES: string[] = ['관련 노트', 'Related Notes'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split('\n');

  return lines.flatMap((line, index) => {
    const match = line.match(HEADING_REGEX);
    if (!match) {
      return [];
    }

    return [
      {
        level: match[1].length,
        line: index,
        raw: line.trim(),
        text: match[2].trim(),
      },
    ];
  });
}

function buildHeadingPattern(templateText: string): RegExp {
  const escaped = escapeRegExp(templateText).replace(/\\\[[^\]]+\\\]/g, '(.+)');
  return new RegExp(`^${escaped}$`);
}

function headingMatches(template: MarkdownHeading, candidate: MarkdownHeading): boolean {
  if (template.level !== candidate.level) {
    return false;
  }

  return buildHeadingPattern(template.text).test(candidate.text);
}

function collectForbiddenSnippets(templateContent: string): string[] {
  const snippets = new Set<string>(ADDITIONAL_FORBIDDEN_SNIPPETS);

  for (const line of templateContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const headingMatch = trimmed.match(HEADING_REGEX);
    if (headingMatch) {
      if (trimmed.includes('[') || trimmed.includes('...') || trimmed.includes('TODO')) {
        snippets.add(trimmed);
      }
      continue;
    }

    snippets.add(trimmed);
  }

  return [...snippets];
}

function isRelatedNotesHeading(heading: MarkdownHeading): boolean {
  return RELATED_NOTES_TITLES.includes(heading.text);
}

export function validateTemplatedKnowledgeNoteContent(
  templateContent: string,
  content: string
): TemplateValidationResult {
  const templateHeadings = parseMarkdownHeadings(templateContent);
  const contentHeadings = parseMarkdownHeadings(content);
  const contentLines = content.split('\n');
  const errors: string[] = [];
  const matchedHeadings: MarkdownHeading[] = [];

  let searchStart = 0;
  for (const templateHeading of templateHeadings) {
    const matchIndex = contentHeadings.findIndex(
      (candidate, index) => index >= searchStart && headingMatches(templateHeading, candidate)
    );

    if (matchIndex === -1) {
      errors.push(`Missing required heading: ${templateHeading.raw}`);
      continue;
    }

    matchedHeadings.push(contentHeadings[matchIndex]);
    searchStart = matchIndex + 1;
  }

  for (const forbiddenSnippet of collectForbiddenSnippets(templateContent)) {
    if (content.includes(forbiddenSnippet)) {
      errors.push(`Template placeholder was not replaced: ${forbiddenSnippet}`);
    }
  }

  matchedHeadings.forEach((heading, index) => {
    const nextHeadingLine = matchedHeadings[index + 1]?.line ?? contentLines.length;
    const sectionBody = contentLines
      .slice(heading.line + 1, nextHeadingLine)
      .join('\n')
      .trim();

    if (heading.level > 1 && !sectionBody) {
      errors.push(`Section is empty: ${heading.raw}`);
      return;
    }

    if (isRelatedNotesHeading(heading) && !/\[\[[^[\]]+\]\]/.test(sectionBody)) {
      errors.push(`Related notes section must include at least one wikilink: ${heading.raw}`);
    }
  });

  return { errors };
}
