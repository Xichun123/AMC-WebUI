// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMcpClientBridge } from './mcpClient';

interface MockClientInstance {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  listResources: ReturnType<typeof vi.fn>;
  listResourceTemplates: ReturnType<typeof vi.fn>;
  readResource: ReturnType<typeof vi.fn>;
  listPrompts: ReturnType<typeof vi.fn>;
  getPrompt: ReturnType<typeof vi.fn>;
}

const sdkMocks = vi.hoisted(() => {
  const clientInstances: MockClientInstance[] = [];
  const clientConstructor = vi.fn(function MockClient() {
    const instance: MockClientInstance = {
      connect: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      listTools: vi.fn(),
      callTool: vi.fn(),
      listResources: vi.fn(),
      listResourceTemplates: vi.fn(),
      readResource: vi.fn(),
      listPrompts: vi.fn(),
      getPrompt: vi.fn(),
    };
    clientInstances.push(instance);
    return instance;
  });

  return {
    clientInstances,
    clientConstructor,
    stdioTransportConstructor: vi.fn(function MockStdioTransport() {
      return { transport: 'stdio' };
    }),
    streamableHttpTransportConstructor: vi.fn(function MockStreamableHttpTransport() {
      return { transport: 'http' };
    }),
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: sdkMocks.clientConstructor,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  getDefaultEnvironment: () => ({ PATH: '/usr/bin' }),
  StdioClientTransport: sdkMocks.stdioTransportConstructor,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: sdkMocks.streamableHttpTransportConstructor,
}));

describe('createMcpClientBridge', () => {
  beforeEach(() => {
    sdkMocks.clientInstances.length = 0;
    vi.clearAllMocks();
  });

  it('lists all MCP tools across paginated SDK responses', async () => {
    const bridge = createMcpClientBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
    };
    sdkMocks.streamableHttpTransportConstructor.mockImplementation(function MockStreamableHttpTransport() {
      return { transport: 'http' };
    });

    const listToolsResults = [
      {
        tools: [
          {
            name: 'first_tool',
            inputSchema: { type: 'object' },
          },
        ],
        nextCursor: 'page-2',
      },
      {
        tools: [
          {
            name: 'second_tool',
            description: 'Second page tool',
            inputSchema: { type: 'object' },
          },
        ],
      },
    ];
    sdkMocks.clientConstructor.mockImplementationOnce(function MockClient() {
      const instance: MockClientInstance = {
        connect: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        listTools: vi.fn().mockResolvedValueOnce(listToolsResults[0]).mockResolvedValueOnce(listToolsResults[1]),
        callTool: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        readResource: vi.fn(),
        listPrompts: vi.fn(),
        getPrompt: vi.fn(),
      };
      sdkMocks.clientInstances.push(instance);
      return instance;
    });

    await expect(bridge.listTools(server)).resolves.toEqual([
      {
        name: 'first_tool',
        inputSchema: { type: 'object' },
      },
      {
        name: 'second_tool',
        description: 'Second page tool',
        inputSchema: { type: 'object' },
      },
    ]);

    const client = sdkMocks.clientInstances[0];
    expect(client.listTools).toHaveBeenNthCalledWith(1, undefined, { timeout: 60_000 });
    expect(client.listTools).toHaveBeenNthCalledWith(2, { cursor: 'page-2' }, { timeout: 60_000 });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it('lists resources, resource templates, and prompts across paginated SDK responses', async () => {
    const bridge = createMcpClientBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
    };

    sdkMocks.clientConstructor
      .mockImplementationOnce(function MockResourceClient() {
        const instance: MockClientInstance = {
          connect: vi.fn(async () => undefined),
          close: vi.fn(async () => undefined),
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources: vi
            .fn()
            .mockResolvedValueOnce({
              resources: [{ uri: 'file:///tmp/one.md', name: 'One' }],
              nextCursor: 'resources-2',
            })
            .mockResolvedValueOnce({
              resources: [{ uri: 'file:///tmp/two.md', name: 'Two' }],
            }),
          listResourceTemplates: vi.fn(),
          readResource: vi.fn(),
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
        };
        sdkMocks.clientInstances.push(instance);
        return instance;
      })
      .mockImplementationOnce(function MockTemplateClient() {
        const instance: MockClientInstance = {
          connect: vi.fn(async () => undefined),
          close: vi.fn(async () => undefined),
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources: vi.fn(),
          listResourceTemplates: vi
            .fn()
            .mockResolvedValueOnce({
              resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'File' }],
              nextCursor: 'templates-2',
            })
            .mockResolvedValueOnce({
              resourceTemplates: [{ uriTemplate: 'db:///{table}', name: 'Table' }],
            }),
          readResource: vi.fn(),
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
        };
        sdkMocks.clientInstances.push(instance);
        return instance;
      })
      .mockImplementationOnce(function MockPromptClient() {
        const instance: MockClientInstance = {
          connect: vi.fn(async () => undefined),
          close: vi.fn(async () => undefined),
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources: vi.fn(),
          listResourceTemplates: vi.fn(),
          readResource: vi.fn(),
          listPrompts: vi
            .fn()
            .mockResolvedValueOnce({
              prompts: [{ name: 'summarize' }],
              nextCursor: 'prompts-2',
            })
            .mockResolvedValueOnce({
              prompts: [{ name: 'rewrite', description: 'Rewrite text' }],
            }),
          getPrompt: vi.fn(),
        };
        sdkMocks.clientInstances.push(instance);
        return instance;
      });

    await expect(bridge.listResources!(server)).resolves.toEqual([
      { uri: 'file:///tmp/one.md', name: 'One' },
      { uri: 'file:///tmp/two.md', name: 'Two' },
    ]);
    await expect(bridge.listResourceTemplates!(server)).resolves.toEqual([
      { uriTemplate: 'file:///{path}', name: 'File' },
      { uriTemplate: 'db:///{table}', name: 'Table' },
    ]);
    await expect(bridge.listPrompts!(server)).resolves.toEqual([
      { name: 'summarize' },
      { name: 'rewrite', description: 'Rewrite text' },
    ]);

    expect(sdkMocks.clientInstances[0].listResources).toHaveBeenNthCalledWith(
      2,
      { cursor: 'resources-2' },
      { timeout: 60_000 },
    );
    expect(sdkMocks.clientInstances[1].listResourceTemplates).toHaveBeenNthCalledWith(
      2,
      { cursor: 'templates-2' },
      { timeout: 60_000 },
    );
    expect(sdkMocks.clientInstances[2].listPrompts).toHaveBeenNthCalledWith(
      2,
      { cursor: 'prompts-2' },
      { timeout: 60_000 },
    );
  });

  it('reads resources, gets prompts, and sends bearer auth through HTTP transport headers', async () => {
    const bridge = createMcpClientBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
      auth: {
        type: 'bearer' as const,
        token: 'secret-token',
      },
    };

    sdkMocks.clientConstructor
      .mockImplementationOnce(function MockReadClient() {
        const instance: MockClientInstance = {
          connect: vi.fn(async () => undefined),
          close: vi.fn(async () => undefined),
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources: vi.fn(),
          listResourceTemplates: vi.fn(),
          readResource: vi.fn(async () => ({
            contents: [{ uri: 'file:///tmp/readme.md', text: 'hello' }],
          })),
          listPrompts: vi.fn(),
          getPrompt: vi.fn(),
        };
        sdkMocks.clientInstances.push(instance);
        return instance;
      })
      .mockImplementationOnce(function MockPromptClient() {
        const instance: MockClientInstance = {
          connect: vi.fn(async () => undefined),
          close: vi.fn(async () => undefined),
          listTools: vi.fn(),
          callTool: vi.fn(),
          listResources: vi.fn(),
          listResourceTemplates: vi.fn(),
          readResource: vi.fn(),
          listPrompts: vi.fn(),
          getPrompt: vi.fn(async () => ({
            messages: [{ role: 'user', content: { type: 'text', text: 'hello prompt' } }],
          })),
        };
        sdkMocks.clientInstances.push(instance);
        return instance;
      });

    await expect(bridge.readResource!(server, 'file:///tmp/readme.md')).resolves.toEqual({
      contents: [{ uri: 'file:///tmp/readme.md', text: 'hello' }],
    });
    await expect(bridge.getPrompt!(server, 'summarize', { topic: 'MCP' })).resolves.toEqual({
      messages: [{ role: 'user', content: { type: 'text', text: 'hello prompt' } }],
    });

    expect(sdkMocks.clientInstances[0].readResource).toHaveBeenCalledWith(
      { uri: 'file:///tmp/readme.md' },
      { timeout: 60_000 },
    );
    expect(sdkMocks.clientInstances[1].getPrompt).toHaveBeenCalledWith(
      { name: 'summarize', arguments: { topic: 'MCP' } },
      { timeout: 60_000 },
    );
    expect(sdkMocks.streamableHttpTransportConstructor).toHaveBeenCalledWith(new URL('https://mcp.example.com/mcp'), {
      requestInit: {
        headers: {
          Authorization: 'Bearer secret-token',
        },
      },
    });
  });
});
