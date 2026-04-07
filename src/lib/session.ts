/**
 * Resolves the current agent session ID from multiple platform sources.
 *
 * Priority order:
 * 1. Explicitly provided value (e.g. from hook stdin JSON)
 * 2. CLAUDE_SESSION_ID  — Claude Code / oh-my-claudecode
 * 3. OPENCODE_SESSION_ID — OpenCode / oh-my-opencode
 * 4. Empty string (session ID unavailable; callers should skip session checks)
 */
export function getSessionId(fromContext?: string): string {
  return (
    fromContext?.trim() ||
    process.env.CLAUDE_SESSION_ID?.trim() ||
    process.env.OPENCODE_SESSION_ID?.trim() ||
    ''
  );
}
