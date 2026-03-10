export function filterByAgentType(content: string, isSubagent: boolean): string {
  // Helper to remove markers and content based on agent type
  const process = (
    text: string,
    marker: 'primary-only' | 'subagent-only',
    shouldRemove: boolean
  ): string => {
    const startTag = `<!-- ${marker} -->`;
    const endTag = `<!-- /${marker} -->`;

    if (!text.includes(startTag)) return text;
    if (!text.includes(endTag)) return text; // Unclosed marker, return as-is

    const regex = new RegExp(`${startTag}\\n?([\\s\\S]*?)${endTag}\\n?`, 'g');

    if (shouldRemove) {
      return text.replace(regex, '');
    } else {
      return text.replace(regex, '$1');
    }
  };

  let filtered = content;

  if (isSubagent) {
    // Subagent: remove primary-only, keep subagent-only content
    filtered = process(filtered, 'primary-only', true);
    filtered = process(filtered, 'subagent-only', false);
  } else {
    // Primary: remove subagent-only, keep primary-only content
    filtered = process(filtered, 'subagent-only', true);
    filtered = process(filtered, 'primary-only', false);
  }

  return filtered;
}
