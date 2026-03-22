export interface ContextConfig {
  knowledge: {
    dir?: string;
    sources: string[];
    mode?: KnowledgeMode;
    indexFilename?: string;
    maxDomainDepth?: number;
  };
  omx?: {
    turnEnd?: {
      strategy?: OmxTurnEndStrategy;
    };
  };
}

export type KnowledgeMode = 'auto' | 'domain' | 'flat';
export type OmxTurnEndStrategy = 'off' | 'turn-complete-sendkeys';

export interface DomainEntry {
  domain: string; // folder name (e.g., 'architecture')
  path: string; // relative path to domain folder (e.g., 'docs/architecture')
  indexContent: string; // full INDEX.md content (truncated to maxIndexFileSize)
  noteCount: number; // number of .md files in domain (excluding INDEX.md)
}

export interface KnowledgeIndex {
  mode: KnowledgeMode;
  domains: DomainEntry[];
  individualFiles: KnowledgeEntry[]; // non-domain files (AGENTS.md, root-level .md, etc.)
}

export interface KnowledgeEntry {
  filename: string; // relative path
  summary: string; // first non-empty line, truncated to 100 chars
}
