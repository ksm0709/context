import { scaffoldIfNeeded } from '../lib/scaffold.js';
import { findGitRoot, resolveProjectPaths } from '../lib/project-root.js';
import { injectIntoAgentsMd } from '../shared/agents-md.js';
import { injectIntoGlobalInstructions } from '../shared/global-instructions.js';
import { STATIC_WORKFLOW_CONTEXT } from '../shared/workflow-context.js';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const paths = resolveProjectPaths(projectDir);
scaffoldIfNeeded(paths.contextParent);
injectIntoAgentsMd(paths.agentsMdPath, STATIC_WORKFLOW_CONTEXT);
injectIntoAgentsMd(paths.claudeMdPath, STATIC_WORKFLOW_CONTEXT);

// Non-git fallback: inject into Claude Code's global CLAUDE.md (~/.claude/CLAUDE.md)
// so instructions are available even when running from home or non-git directories
if (!findGitRoot(projectDir)) {
  injectIntoGlobalInstructions('claude', STATIC_WORKFLOW_CONTEXT);
}
