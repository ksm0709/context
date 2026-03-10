export async function isSubagentSession(
  getSession: (id: string) => Promise<{ parentID?: string } | undefined>,
  sessionID: string,
  cache: Map<string, boolean>
): Promise<boolean> {
  if (!sessionID) return false;
  if (cache.has(sessionID)) return cache.get(sessionID)!;
  try {
    const session = await getSession(sessionID);
    const result = !!session?.parentID;
    cache.set(sessionID, result);
    return result;
  } catch {
    return false;
  }
}
