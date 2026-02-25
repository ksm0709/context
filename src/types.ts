export interface ContextConfig {
  prompts: {
    turnStart?: string;
    turnEnd?: string;
  };
  knowledge: {
    dir?: string;
    sources: string[];
  };
}

export interface KnowledgeEntry {
  filename: string; // relative path
  summary: string; // first non-empty line, truncated to 100 chars
}
