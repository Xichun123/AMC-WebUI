import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  McpClientBridge,
  McpPrompt,
  McpResource,
  McpResourceTemplate,
  McpServerConfig,
  McpTool,
} from './mcpTypes.js';

const MCP_REQUEST_TIMEOUT_MS = 60_000;

function createHttpHeaders(server: McpServerConfig): Record<string, string> | undefined {
  const headers = { ...(server.headers ?? {}) };
  const bearerToken = server.auth?.type === 'bearer' ? server.auth.token?.trim() : '';

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function createTransport(server: McpServerConfig): Transport {
  if (server.transport === 'stdio') {
    if (!server.command?.trim()) {
      throw new Error('MCP stdio server command is required.');
    }

    return new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: server.env ? { ...getDefaultEnvironment(), ...server.env } : undefined,
      stderr: 'pipe',
    });
  }

  if (!server.url?.trim()) {
    throw new Error('MCP HTTP server URL is required.');
  }

  const headers = createHttpHeaders(server);

  return new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: headers ? { headers } : undefined,
  });
}

async function withConnectedClient<T>(server: McpServerConfig, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    name: 'amc-webui',
    version: '1.8.11',
  });
  const transport = createTransport(server);

  try {
    await client.connect(transport, { timeout: MCP_REQUEST_TIMEOUT_MS });
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export const createMcpClientBridge = (): McpClientBridge => ({
  listTools: async (server) =>
    withConnectedClient(server, async (client) => {
      const tools: McpTool[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listTools(cursor ? { cursor } : undefined, { timeout: MCP_REQUEST_TIMEOUT_MS });
        tools.push(
          ...result.tools.map<McpTool>((tool) => ({
            name: tool.name,
            ...(tool.description ? { description: tool.description } : {}),
            inputSchema: tool.inputSchema,
          })),
        );
        cursor = result.nextCursor;
      } while (cursor);

      return tools;
    }),

  callTool: async (server, toolName, args) =>
    withConnectedClient(server, (client) =>
      client.callTool(
        {
          name: toolName,
          arguments: args,
        },
        undefined,
        { timeout: MCP_REQUEST_TIMEOUT_MS },
      ),
    ),

  listResources: async (server) =>
    withConnectedClient(server, async (client) => {
      const resources: McpResource[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listResources(cursor ? { cursor } : undefined, { timeout: MCP_REQUEST_TIMEOUT_MS });
        resources.push(
          ...result.resources.map<McpResource>((resource) => ({
            uri: resource.uri,
            name: resource.name,
            ...(resource.description ? { description: resource.description } : {}),
            ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
            ...(typeof resource.size === 'number' ? { size: resource.size } : {}),
          })),
        );
        cursor = result.nextCursor;
      } while (cursor);

      return resources;
    }),

  listResourceTemplates: async (server) =>
    withConnectedClient(server, async (client) => {
      const resourceTemplates: McpResourceTemplate[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listResourceTemplates(cursor ? { cursor } : undefined, {
          timeout: MCP_REQUEST_TIMEOUT_MS,
        });
        resourceTemplates.push(
          ...result.resourceTemplates.map<McpResourceTemplate>((template) => ({
            uriTemplate: template.uriTemplate,
            name: template.name,
            ...(template.description ? { description: template.description } : {}),
            ...(template.mimeType ? { mimeType: template.mimeType } : {}),
          })),
        );
        cursor = result.nextCursor;
      } while (cursor);

      return resourceTemplates;
    }),

  readResource: async (server, uri) =>
    withConnectedClient(server, (client) => client.readResource({ uri }, { timeout: MCP_REQUEST_TIMEOUT_MS })),

  listPrompts: async (server) =>
    withConnectedClient(server, async (client) => {
      const prompts: McpPrompt[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listPrompts(cursor ? { cursor } : undefined, { timeout: MCP_REQUEST_TIMEOUT_MS });
        prompts.push(
          ...result.prompts.map<McpPrompt>((prompt) => ({
            name: prompt.name,
            ...(prompt.description ? { description: prompt.description } : {}),
            ...(prompt.arguments ? { arguments: prompt.arguments } : {}),
          })),
        );
        cursor = result.nextCursor;
      } while (cursor);

      return prompts;
    }),

  getPrompt: async (server, promptName, args) =>
    withConnectedClient(server, (client) =>
      client.getPrompt(
        {
          name: promptName,
          arguments: args,
        },
        { timeout: MCP_REQUEST_TIMEOUT_MS },
      ),
    ),
});
