import type { McpServerConfig } from '../../shared/mcpServerConfig.js';

export type { McpServerConfig } from '../../shared/mcpServerConfig.js';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

export interface McpClientBridge {
  listTools(server: McpServerConfig): Promise<McpTool[]>;
  callTool(server: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<unknown>;
  listResources?(server: McpServerConfig): Promise<McpResource[]>;
  listResourceTemplates?(server: McpServerConfig): Promise<McpResourceTemplate[]>;
  readResource?(server: McpServerConfig, uri: string): Promise<unknown>;
  listPrompts?(server: McpServerConfig): Promise<McpPrompt[]>;
  getPrompt?(server: McpServerConfig, promptName: string, args: Record<string, string>): Promise<unknown>;
}
