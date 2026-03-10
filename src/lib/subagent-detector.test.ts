import { describe, it, expect, vi } from 'vitest';
import { isSubagentSession } from './subagent-detector.js';

describe('isSubagentSession', () => {
  it('returns true when session has parentID', async () => {
    const getSession = vi.fn().mockResolvedValue({ parentID: 'parent-1' });
    const cache = new Map<string, boolean>();
    expect(await isSubagentSession(getSession, 'sess-1', cache)).toBe(true);
  });

  it('returns false when session has parentID undefined', async () => {
    const getSession = vi.fn().mockResolvedValue({ parentID: undefined });
    const cache = new Map<string, boolean>();
    expect(await isSubagentSession(getSession, 'sess-1', cache)).toBe(false);
  });

  it('returns false when getSession returns undefined', async () => {
    const getSession = vi.fn().mockResolvedValue(undefined);
    const cache = new Map<string, boolean>();
    expect(await isSubagentSession(getSession, 'sess-1', cache)).toBe(false);
  });

  it('returns false when getSession throws', async () => {
    const getSession = vi.fn().mockRejectedValue(new Error('fail'));
    const cache = new Map<string, boolean>();
    expect(await isSubagentSession(getSession, 'sess-1', cache)).toBe(false);
  });

  it('uses cache for same sessionID', async () => {
    const getSession = vi.fn().mockResolvedValue({ parentID: 'parent-1' });
    const cache = new Map<string, boolean>();
    await isSubagentSession(getSession, 'sess-1', cache);
    await isSubagentSession(getSession, 'sess-1', cache);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('fetches independently for different sessionIDs', async () => {
    const getSession = vi.fn().mockResolvedValue({ parentID: 'parent-1' });
    const cache = new Map<string, boolean>();
    await isSubagentSession(getSession, 'sess-1', cache);
    await isSubagentSession(getSession, 'sess-2', cache);
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('returns false immediately for empty string sessionID', async () => {
    const getSession = vi.fn();
    const cache = new Map<string, boolean>();
    expect(await isSubagentSession(getSession, '', cache)).toBe(false);
    expect(getSession).not.toHaveBeenCalled();
  });
});
