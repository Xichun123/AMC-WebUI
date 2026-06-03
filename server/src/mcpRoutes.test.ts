// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from './createServer';
import { createHttpServerCleanup, startHttpServer } from '../test/httpServer';

const serverCleanup = createHttpServerCleanup();

afterEach(serverCleanup.cleanup);

describe('MCP routes', () => {
  it('does not execute stdio MCP servers unless the API server enables stdio transport', async () => {
    const listTools = vi.fn();
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servers: [
          {
            id: 'filesystem',
            name: 'Filesystem',
            enabled: true,
            transport: 'stdio',
            command: 'npx',
          },
        ],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(listTools).not.toHaveBeenCalled();
    expect(body).toEqual({
      servers: [],
      errors: [
        {
          serverId: 'filesystem',
          serverName: 'Filesystem',
          error: 'MCP stdio transport is disabled on this API server.',
        },
      ],
    });
  });

  it('lists tools for enabled MCP servers', async () => {
    const listTools = vi.fn(async () => [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
    ]);
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
        enableMcpStdio: true,
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const enabledServer = {
      id: 'filesystem',
      name: 'Filesystem',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    };
    const disabledServer = {
      id: 'disabled',
      name: 'Disabled',
      enabled: false,
      transport: 'stdio',
      command: 'node',
    };

    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ servers: [enabledServer, disabledServer] }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(listTools).toHaveBeenCalledTimes(1);
    expect(listTools).toHaveBeenCalledWith(enabledServer);
    expect(body).toEqual({
      servers: [
        {
          serverId: 'filesystem',
          serverName: 'Filesystem',
          tools: [
            {
              name: 'read_file',
              description: 'Read a file',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                },
                required: ['path'],
              },
            },
          ],
        },
      ],
      errors: [],
    });
  });

  it('rejects HTTP MCP servers that do not use HTTP or HTTPS URLs', async () => {
    const listTools = vi.fn();
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servers: [
          {
            id: 'local-file',
            name: 'Local File',
            enabled: true,
            transport: 'http',
            url: 'file:///tmp/mcp',
          },
        ],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(listTools).not.toHaveBeenCalled();
    expect(body).toEqual({
      servers: [],
      errors: [
        {
          serverId: 'local-file',
          serverName: 'Local File',
          error: 'MCP HTTP server URL must use http:// or https://.',
        },
      ],
    });
  });

  it('rejects private HTTP MCP server URLs unless private HTTP is explicitly enabled', async () => {
    const listTools = vi.fn();
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servers: [
          {
            id: 'local-http',
            name: 'Local HTTP',
            enabled: true,
            transport: 'http',
            url: 'http://127.0.0.1:3333/mcp',
          },
        ],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(listTools).not.toHaveBeenCalled();
    expect(body).toEqual({
      servers: [],
      errors: [
        {
          serverId: 'local-http',
          serverName: 'Local HTTP',
          error: 'Private MCP HTTP server URLs are disabled on this API server.',
        },
      ],
    });
  });

  it('ignores disabled MCP servers without reporting URL validation errors', async () => {
    const listTools = vi.fn();
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servers: [
          {
            id: 'disabled-local',
            name: 'Disabled Local',
            enabled: false,
            transport: 'http',
            url: 'http://127.0.0.1:3333/mcp',
          },
        ],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(listTools).not.toHaveBeenCalled();
    expect(body).toEqual({
      servers: [],
      errors: [],
    });
  });

  it('allows private HTTP MCP server URLs when private HTTP is explicitly enabled', async () => {
    const listTools = vi.fn(async () => [
      {
        name: 'local_tool',
        inputSchema: {
          type: 'object',
        },
      },
    ]);
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
        enableMcpPrivateHttp: true,
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const localServer = {
      id: 'local-http',
      name: 'Local HTTP',
      enabled: true,
      transport: 'http',
      url: 'http://127.0.0.1:3333/mcp',
    };
    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        servers: [localServer],
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(listTools).toHaveBeenCalledWith(localServer);
    expect(body).toEqual({
      servers: [
        {
          serverId: 'local-http',
          serverName: 'Local HTTP',
          tools: [
            {
              name: 'local_tool',
              inputSchema: {
                type: 'object',
              },
            },
          ],
        },
      ],
      errors: [],
    });
  });

  it('returns a client error for malformed MCP JSON request bodies', async () => {
    const listTools = vi.fn();
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools,
          callTool: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const response = await fetch(`${started.baseUrl}/api/mcp/tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(listTools).not.toHaveBeenCalled();
    expect(body).toEqual({
      error: 'MCP request body must be valid JSON.',
    });
  });

  it('calls an MCP tool on the selected server', async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: 'hello from MCP' }],
      structuredContent: { ok: true },
    }));
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
        enableMcpStdio: true,
      },
      {
        mcpClient: {
          listTools: vi.fn(),
          callTool,
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const server = {
      id: 'filesystem',
      name: 'Filesystem',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    };
    const args = { path: '/tmp/example.txt' };

    const response = await fetch(`${started.baseUrl}/api/mcp/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ server, toolName: 'read_file', args }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(callTool).toHaveBeenCalledWith(server, 'read_file', args);
    expect(body).toEqual({
      result: {
        content: [{ type: 'text', text: 'hello from MCP' }],
        structuredContent: { ok: true },
      },
    });
  });

  it('lists MCP resources and prompts for enabled HTTP servers', async () => {
    const listResources = vi.fn(async () => [
      {
        uri: 'file:///tmp/readme.md',
        name: 'README',
        description: 'Project notes',
        mimeType: 'text/markdown',
      },
    ]);
    const listResourceTemplates = vi.fn(async () => [
      {
        uriTemplate: 'file:///{path}',
        name: 'Workspace file',
        description: 'Read a workspace file by path',
      },
    ]);
    const listPrompts = vi.fn(async () => [
      {
        name: 'summarize',
        description: 'Summarize a topic',
        arguments: [{ name: 'topic', required: true }],
      },
    ]);
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources,
          listResourceTemplates,
          listPrompts,
          readResource: vi.fn(),
          getPrompt: vi.fn(),
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
    };

    const resourcesResponse = await fetch(`${started.baseUrl}/api/mcp/resources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ servers: [server] }),
    });
    const resourcesBody = (await resourcesResponse.json()) as Record<string, unknown>;

    expect(resourcesResponse.status).toBe(200);
    expect(listResources).toHaveBeenCalledWith(server);
    expect(listResourceTemplates).toHaveBeenCalledWith(server);
    expect(resourcesBody).toEqual({
      servers: [
        {
          serverId: 'remote',
          serverName: 'Remote',
          resources: [
            {
              uri: 'file:///tmp/readme.md',
              name: 'README',
              description: 'Project notes',
              mimeType: 'text/markdown',
            },
          ],
          resourceTemplates: [
            {
              uriTemplate: 'file:///{path}',
              name: 'Workspace file',
              description: 'Read a workspace file by path',
            },
          ],
        },
      ],
      errors: [],
    });

    const promptsResponse = await fetch(`${started.baseUrl}/api/mcp/prompts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ servers: [server] }),
    });
    const promptsBody = (await promptsResponse.json()) as Record<string, unknown>;

    expect(promptsResponse.status).toBe(200);
    expect(listPrompts).toHaveBeenCalledWith(server);
    expect(promptsBody).toEqual({
      servers: [
        {
          serverId: 'remote',
          serverName: 'Remote',
          prompts: [
            {
              name: 'summarize',
              description: 'Summarize a topic',
              arguments: [{ name: 'topic', required: true }],
            },
          ],
        },
      ],
      errors: [],
    });
  });

  it('reads MCP resources and gets prompts from the selected server', async () => {
    const readResource = vi.fn(async () => ({
      contents: [{ uri: 'file:///tmp/readme.md', text: 'hello', mimeType: 'text/markdown' }],
    }));
    const getPrompt = vi.fn(async () => ({
      description: 'Summarize a topic',
      messages: [{ role: 'user', content: { type: 'text', text: 'Summarize MCP' } }],
    }));
    const app = createServer(
      {
        geminiApiBase: 'https://example.test',
        geminiApiKey: 'server-key',
      },
      {
        mcpClient: {
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources: vi.fn(),
          listResourceTemplates: vi.fn(),
          listPrompts: vi.fn(),
          readResource,
          getPrompt,
        },
      },
    );
    const started = serverCleanup.track(await startHttpServer(app));

    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
    };

    const resourceResponse = await fetch(`${started.baseUrl}/api/mcp/resource`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ server, uri: 'file:///tmp/readme.md' }),
    });
    const resourceBody = (await resourceResponse.json()) as Record<string, unknown>;

    expect(resourceResponse.status).toBe(200);
    expect(readResource).toHaveBeenCalledWith(server, 'file:///tmp/readme.md');
    expect(resourceBody).toEqual({
      result: {
        contents: [{ uri: 'file:///tmp/readme.md', text: 'hello', mimeType: 'text/markdown' }],
      },
    });

    const promptArgs = { topic: 'MCP' };
    const promptResponse = await fetch(`${started.baseUrl}/api/mcp/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ server, promptName: 'summarize', args: promptArgs }),
    });
    const promptBody = (await promptResponse.json()) as Record<string, unknown>;

    expect(promptResponse.status).toBe(200);
    expect(getPrompt).toHaveBeenCalledWith(server, 'summarize', promptArgs);
    expect(promptBody).toEqual({
      result: {
        description: 'Summarize a topic',
        messages: [{ role: 'user', content: { type: 'text', text: 'Summarize MCP' } }],
      },
    });
  });
});
