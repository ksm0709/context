import { scaffoldIfNeeded } from '../lib/scaffold.js';
import { injectIntoAgentsMd } from '../shared/agents-md.js';
import { STATIC_KNOWLEDGE_CONTEXT } from '../shared/knowledge-context.js';
import { join } from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
scaffoldIfNeeded(projectDir);
injectIntoAgentsMd(join(projectDir, 'AGENTS.md'), STATIC_KNOWLEDGE_CONTEXT);
