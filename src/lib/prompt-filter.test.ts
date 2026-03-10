import { describe, it, expect } from 'vitest';
import { filterByAgentType } from './prompt-filter.ts';

describe('filterByAgentType', () => {
  it('returns unchanged when no markers and isSubagent=false', () => {
    expect(filterByAgentType('hello world', false)).toBe('hello world');
  });

  it('returns unchanged when no markers and isSubagent=true', () => {
    expect(filterByAgentType('hello world', true)).toBe('hello world');
  });

  it('strips primary-only markers and preserves content when isSubagent=false', () => {
    const input = '<!-- primary-only -->\nkeep me\n<!-- /primary-only -->';
    expect(filterByAgentType(input, false)).toBe('keep me\n');
  });

  it('removes entire primary-only block when isSubagent=true', () => {
    const input = '<!-- primary-only -->\nremove me\n<!-- /primary-only -->';
    expect(filterByAgentType(input, true)).toBe('');
  });

  it('removes entire subagent-only block when isSubagent=false', () => {
    const input = '<!-- subagent-only -->\nremove me\n<!-- /subagent-only -->';
    expect(filterByAgentType(input, false)).toBe('');
  });

  it('strips subagent-only markers and preserves content when isSubagent=true', () => {
    const input = '<!-- subagent-only -->\nkeep me\n<!-- /subagent-only -->';
    expect(filterByAgentType(input, true)).toBe('keep me\n');
  });

  it('filters mixed block types correctly', () => {
    const input =
      '<!-- primary-only -->\nkeep primary\n<!-- /primary-only -->\n<!-- subagent-only -->\nkeep subagent\n<!-- /subagent-only -->';
    expect(filterByAgentType(input, false)).toBe('keep primary\n');
    expect(filterByAgentType(input, true)).toBe('keep subagent\n');
  });

  it('returns empty string when input is empty', () => {
    expect(filterByAgentType('', false)).toBe('');
  });

  it('processes multi-line content correctly', () => {
    const input =
      '<!-- primary-only -->\nline1\nline2\nline3\nline4\nline5\n<!-- /primary-only -->';
    expect(filterByAgentType(input, false)).toBe('line1\nline2\nline3\nline4\nline5\n');
  });

  it('handles multiple same-type markers independently', () => {
    const input =
      '<!-- primary-only -->\n1\n<!-- /primary-only -->\n<!-- primary-only -->\n2\n<!-- /primary-only -->';
    expect(filterByAgentType(input, false)).toBe('1\n2\n');
  });

  it('returns content as-is when marker is unclosed', () => {
    const input = '<!-- primary-only -->\nkeep me';
    expect(filterByAgentType(input, false)).toBe('<!-- primary-only -->\nkeep me');
  });
});
