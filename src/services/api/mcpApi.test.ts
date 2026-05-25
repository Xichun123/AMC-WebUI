import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServerConfig } from '@/types';
import {
  fetchMcpPrompts,
  fetchMcpResources,
  fetchMcpServerCapabilities,
  getMcpPrompt,
  readMcpResource,
} from './mcpApi';

const fetchMock = vi.fn();

describe('mcpApi', () => {
  const server: McpServerConfig = {
    id: 'remote',
    name: 'Remote',
    enabled: true,
    transport: 'http',
    url: 'https://mcp.example.com/mcp',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  it('uses dedicated MCP endpoints for resources and prompts', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            servers: [{ serverId: 'remote', serverName: 'Remote', resources: [], resourceTemplates: [] }],
            errors: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            servers: [{ serverId: 'remote', serverName: 'Remote', prompts: [] }],
            errors: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { contents: [{ uri: 'file:///tmp/readme.md', text: 'hello' }] } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: { messages: [{ role: 'user', content: { type: 'text', text: 'hi' } }] } }),
          {
            status: 200,
          },
        ),
      );

    await fetchMcpResources([server]);
    await fetchMcpPrompts([server]);
    await readMcpResource(server, 'file:///tmp/readme.md');
    await getMcpPrompt(server, 'summarize', { topic: 'MCP' });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/mcp/resources',
      '/api/mcp/prompts',
      '/api/mcp/resource',
      '/api/mcp/prompt',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ server, uri: 'file:///tmp/readme.md' });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      server,
      promptName: 'summarize',
      args: { topic: 'MCP' },
    });
  });

  it('combines tools, resources, resource templates, and prompts for one server capability check', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            servers: [{ serverId: 'remote', serverName: 'Remote', tools: [{ name: 'read_file' }] }],
            errors: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            servers: [
              {
                serverId: 'remote',
                serverName: 'Remote',
                resources: [{ uri: 'file:///tmp/readme.md', name: 'README' }],
                resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'File' }],
              },
            ],
            errors: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            servers: [{ serverId: 'remote', serverName: 'Remote', prompts: [{ name: 'summarize' }] }],
            errors: [],
          }),
          { status: 200 },
        ),
      );

    await expect(fetchMcpServerCapabilities(server)).resolves.toEqual({
      tools: [{ name: 'read_file' }],
      resources: [{ uri: 'file:///tmp/readme.md', name: 'README' }],
      resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'File' }],
      prompts: [{ name: 'summarize' }],
      errors: [],
    });
  });
});
