import type { McpServerConfig } from '@/types';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

export interface McpResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpToolsResponse {
  servers: Array<{
    serverId: string;
    serverName: string;
    tools: McpToolDefinition[];
  }>;
  errors: Array<{
    serverId: string;
    serverName: string;
    error: string;
  }>;
}

interface McpResourcesResponse {
  servers: Array<{
    serverId: string;
    serverName: string;
    resources: McpResourceDefinition[];
    resourceTemplates: McpResourceTemplateDefinition[];
  }>;
  errors: Array<{
    serverId: string;
    serverName: string;
    error: string;
  }>;
}

interface McpPromptsResponse {
  servers: Array<{
    serverId: string;
    serverName: string;
    prompts: McpPromptDefinition[];
  }>;
  errors: Array<{
    serverId: string;
    serverName: string;
    error: string;
  }>;
}

export interface McpServerCapabilities {
  tools: McpToolDefinition[];
  resources: McpResourceDefinition[];
  resourceTemplates: McpResourceTemplateDefinition[];
  prompts: McpPromptDefinition[];
  errors: Array<{
    serverId: string;
    serverName: string;
    error: string;
  }>;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : `MCP request failed with ${response.status}.`;
  } catch {
    return `MCP request failed with ${response.status}.`;
  }
};

export const fetchMcpTools = async (
  servers: McpServerConfig[],
  abortSignal?: AbortSignal,
): Promise<McpToolsResponse> => {
  const response = await fetch('/api/mcp/tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ servers }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as McpToolsResponse;
};

export const fetchMcpResources = async (
  servers: McpServerConfig[],
  abortSignal?: AbortSignal,
): Promise<McpResourcesResponse> => {
  const response = await fetch('/api/mcp/resources', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ servers }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as McpResourcesResponse;
};

export const fetchMcpPrompts = async (
  servers: McpServerConfig[],
  abortSignal?: AbortSignal,
): Promise<McpPromptsResponse> => {
  const response = await fetch('/api/mcp/prompts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ servers }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as McpPromptsResponse;
};

export const callMcpTool = async (
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  abortSignal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch('/api/mcp/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ server, toolName, args }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { result?: unknown };
  return body.result;
};

export const readMcpResource = async (
  server: McpServerConfig,
  uri: string,
  abortSignal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch('/api/mcp/resource', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ server, uri }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { result?: unknown };
  return body.result;
};

export const getMcpPrompt = async (
  server: McpServerConfig,
  promptName: string,
  args: Record<string, string> = {},
  abortSignal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch('/api/mcp/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ server, promptName, args }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { result?: unknown };
  return body.result;
};

export const fetchMcpServerCapabilities = async (
  server: McpServerConfig,
  abortSignal?: AbortSignal,
): Promise<McpServerCapabilities> => {
  const [toolsResponse, resourcesResponse, promptsResponse] = await Promise.all([
    fetchMcpTools([server], abortSignal),
    fetchMcpResources([server], abortSignal),
    fetchMcpPrompts([server], abortSignal),
  ]);
  const toolServer = toolsResponse.servers.find((entry) => entry.serverId === server.id);
  const resourceServer = resourcesResponse.servers.find((entry) => entry.serverId === server.id);
  const promptServer = promptsResponse.servers.find((entry) => entry.serverId === server.id);

  return {
    tools: toolServer?.tools ?? [],
    resources: resourceServer?.resources ?? [],
    resourceTemplates: resourceServer?.resourceTemplates ?? [],
    prompts: promptServer?.prompts ?? [],
    errors: [...toolsResponse.errors, ...resourcesResponse.errors, ...promptsResponse.errors],
  };
};
