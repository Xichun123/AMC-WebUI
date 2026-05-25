import { describe, expect, it } from 'vitest';
import { toMcpFunctionName } from './mcpToolNames';

describe('MCP tool function names', () => {
  it('builds stable Gemini-compatible names from server and tool names', () => {
    const name = toMcpFunctionName('filesystem-local', 'read_file');

    expect(name).toMatch(/^mcp_[A-Za-z0-9_]+$/);
    expect(name.length).toBeLessThanOrEqual(64);
    expect(toMcpFunctionName('filesystem-local', 'read_file')).toBe(name);
  });

  it('keeps long or unusual names valid and distinct', () => {
    const first = toMcpFunctionName(
      'my very long local filesystem server with spaces and symbols',
      'read-file.with:odd/chars',
    );
    const second = toMcpFunctionName(
      'my very long local filesystem server with spaces and symbols',
      'write-file.with:odd/chars',
    );

    expect(first).toMatch(/^mcp_[A-Za-z0-9_]+$/);
    expect(first.length).toBeLessThanOrEqual(64);
    expect(second).toMatch(/^mcp_[A-Za-z0-9_]+$/);
    expect(second.length).toBeLessThanOrEqual(64);
    expect(first).not.toBe(second);
  });
});
