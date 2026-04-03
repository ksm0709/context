import { scaffoldIfNeeded } from '../lib/scaffold.js';
import { resolveProjectPaths } from '../lib/project-root.js';
import { injectIntoAgentsMd } from '../shared/agents-md.js';
import { STATIC_KNOWLEDGE_CONTEXT } from '../shared/knowledge-context.js';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const paths = resolveProjectPaths(projectDir);
scaffoldIfNeeded(paths.contextParent);
injectIntoAgentsMd(paths.agentsMdPath, STATIC_KNOWLEDGE_CONTEXT);
injectIntoAgentsMd(paths.claudeMdPath, STATIC_KNOWLEDGE_CONTEXT);
