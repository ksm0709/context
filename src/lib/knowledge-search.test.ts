import { describe, expect, it } from 'vitest';

import {
  parseKnowledgeNote,
  resolveRelatedKnowledgeLinks,
  searchKnowledgeNotes,
} from './knowledge-search.js';

describe('knowledge-search', () => {
  describe('parseKnowledgeNote', () => {
    it('prefers frontmatter metadata for title, description, and tags', () => {
      const note = parseKnowledgeNote(
        'docs/metadata-search.md',
        `---
title: Metadata Search
description: Weighted discovery for context notes.
tags:
  - search
  - context
---

# Ignored Heading

Body paragraph.
`
      );

      expect(note.title).toBe('Metadata Search');
      expect(note.description).toBe('Weighted discovery for context notes.');
      expect(note.tags).toEqual(['search', 'context']);
    });

    it('falls back to heading and first paragraph when frontmatter is absent', () => {
      const note = parseKnowledgeNote(
        'docs/fallback-note.md',
        `# Fallback Heading

First meaningful paragraph for fallback description.

## Later Section

More text.
`
      );

      expect(note.title).toBe('Fallback Heading');
      expect(note.description).toBe('First meaningful paragraph for fallback description.');
      expect(note.tags).toEqual([]);
    });
  });

  describe('searchKnowledgeNotes', () => {
    it('ranks title and tag matches above body-only overlap', () => {
      const notes = [
        parseKnowledgeNote(
          'docs/body-only.md',
          `# Body Only

This note mentions metadata search once in the body for agents.
`
        ),
        parseKnowledgeNote(
          'docs/metadata-search.md',
          `---
title: Metadata Search
description: Find related notes by metadata first.
tags: [search, knowledge]
---

# Metadata Search

Body text.
`
        ),
      ];

      const results = searchKnowledgeNotes(
        notes,
        'How do I find related knowledge notes with metadata search?',
        10
      );

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Metadata Search');
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].matchReasons.join(',')).toContain('title');
      expect(results[0].matchReasons.join(',')).toContain('tags');
    });
  });

  describe('resolveRelatedKnowledgeLinks', () => {
    it('resolves wikilinks by note title and reports unresolved links separately', () => {
      const notes = [
        parseKnowledgeNote(
          'docs/entry.md',
          `---
title: Entry Note
---

See [[Related Note]] and [[Missing Note]].
`
        ),
        parseKnowledgeNote(
          'docs/related-note.md',
          `---
title: Related Note
description: Linked metadata.
tags: [linked]
---

# Related Note

More details.
`
        ),
      ];

      const related = resolveRelatedKnowledgeLinks(notes, 'docs/entry.md', [
        'Related Note',
        'Missing Note',
      ]);

      expect(related.resolved).toHaveLength(1);
      expect(related.resolved[0].file).toBe('docs/related-note.md');
      expect(related.unresolved).toEqual(['Missing Note']);
    });
  });
});
