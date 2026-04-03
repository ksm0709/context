import { homedir } from 'node:os';
import { join } from 'node:path';
import { injectIntoAgentsMd } from './agents-md.js';

export type CliTool = 'claude' | 'codex';

/**
 * Get the global instruction file path for each CLI tool.
 * These are the files CLI tools read regardless of project context.
 *
 * - Claude Code: ~/.claude/CLAUDE.md
 * - Codex (OMX): ~/.codex/instructions.md
 */
export function getGlobalInstructionPath(tool: CliTool): string {
  const home = homedir();
  switch (tool) {
    case 'claude':
      return join(home, '.claude', 'CLAUDE.md');
    case 'codex':
      return join(home, '.codex', 'instructions.md');
  }
}

/**
 * Inject knowledge context into a CLI tool's global instruction file.
 * Uses marker-based injection (<!-- context:start/end -->) for idempotency.
 */
export function injectIntoGlobalInstructions(tool: CliTool, content: string): void {
  const path = getGlobalInstructionPath(tool);
  injectIntoAgentsMd(path, content);
}
