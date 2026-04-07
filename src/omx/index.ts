// OpenCode plugin entry — functionality migrated to native MCP + hook registration
export async function onHookEvent(): Promise<void> {
  // no-op: context is now registered via ~/.config/opencode/opencode.json mcp section
}
