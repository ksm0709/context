export interface ContextConfig {
  prompts: {
    turnStart?: string;
    turnEnd?: string;
  };
  knowledge: {
    sources: string[];
  };
}

export interface KnowledgeEntry {
  filename: string; // relative path
  summary: string; // first non-empty line, truncated to 100 chars
}
