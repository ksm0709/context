import { scaffoldIfNeeded } from '../lib/scaffold.js';
import { findGitRoot, resolveProjectPaths } from '../lib/project-root.js';
import { injectIntoAgentsMd } from '../shared/agents-md.js';
import { injectIntoGlobalInstructions } from '../shared/global-instructions.js';
import { STATIC_WORKFLOW_CONTEXT } from '../shared/workflow-context.js';

interface SessionStartInput {
  cwd?: string;
}

const input = JSON.parse(await Bun.stdin.text()) as SessionStartInput;
const projectDir = input.cwd ?? process.cwd();
const paths = resolveProjectPaths(projectDir);

scaffoldIfNeeded(paths.contextParent);
injectIntoAgentsMd(paths.agentsMdPath, STATIC_WORKFLOW_CONTEXT);
injectIntoAgentsMd(paths.claudeMdPath, STATIC_WORKFLOW_CONTEXT);

if (!findGitRoot(projectDir)) {
  injectIntoGlobalInstructions('codex', STATIC_WORKFLOW_CONTEXT);
}

process.stdout.write(
  JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: STATIC_WORKFLOW_CONTEXT,
    },
  })
);
