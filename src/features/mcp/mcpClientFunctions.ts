import { Type, type Schema } from '@google/genai';
import type { McpServerConfig, StandardClientFunctions } from '@/types';
import { callMcpTool, fetchMcpTools, type McpToolDefinition, type McpToolsResponse } from '@/services/api/mcpApi';
import { toMcpFunctionName } from './mcpToolNames';

interface CreateMcpClientFunctionsOptions {
  servers: McpServerConfig[];
  abortSignal?: AbortSignal;
  listTools?: (servers: McpServerConfig[], abortSignal?: AbortSignal) => Promise<McpToolsResponse>;
  callTool?: (
    server: McpServerConfig,
    toolName: string,
    args: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toSchemaType = (value: unknown): Type | undefined => {
  switch (value) {
    case 'object':
      return Type.OBJECT;
    case 'array':
      return Type.ARRAY;
    case 'string':
      return Type.STRING;
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'null':
      return Type.NULL;
    default:
      return undefined;
  }
};

const toGeminiSchema = (schema: unknown): Schema => {
  if (!isRecord(schema)) {
    return { type: Type.OBJECT };
  }

  const type = toSchemaType(schema.type) ?? Type.OBJECT;
  const geminiSchema: Schema = {
    type,
  };

  if (typeof schema.description === 'string') {
    geminiSchema.description = schema.description;
  }
  if (Array.isArray(schema.enum)) {
    const enumValues = schema.enum.filter((item): item is string => typeof item === 'string');
    if (enumValues.length > 0) {
      geminiSchema.enum = enumValues;
      geminiSchema.format = 'enum';
    }
  }
  if (typeof schema.format === 'string' && !geminiSchema.format) {
    geminiSchema.format = schema.format;
  }

  if (type === Type.OBJECT && isRecord(schema.properties)) {
    geminiSchema.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (type === Type.OBJECT && Array.isArray(schema.required)) {
    const required = schema.required.filter((item): item is string => typeof item === 'string');
    if (required.length > 0) {
      geminiSchema.required = required;
    }
  }
  if (type === Type.ARRAY && schema.items !== undefined) {
    geminiSchema.items = toGeminiSchema(schema.items);
  }

  return geminiSchema;
};

const buildDescription = (serverName: string, tool: McpToolDefinition): string => {
  const base = `MCP tool ${tool.name} from ${serverName}.`;
  return tool.description ? `${base} ${tool.description}` : base;
};

const makeRuntimeServerEntries = (
  servers: McpServerConfig[],
): Array<{ originalServer: McpServerConfig; runtimeServer: McpServerConfig }> => {
  const usedServerIds = new Set<string>();

  return servers.map((server) => {
    let runtimeId = server.id;
    let suffix = 2;
    while (usedServerIds.has(runtimeId)) {
      runtimeId = `${server.id}__${suffix}`;
      suffix += 1;
    }
    usedServerIds.add(runtimeId);

    return {
      originalServer: server,
      runtimeServer: runtimeId === server.id ? server : { ...server, id: runtimeId },
    };
  });
};

export const createMcpClientFunctions = async ({
  servers,
  abortSignal,
  listTools = fetchMcpTools,
  callTool = callMcpTool,
}: CreateMcpClientFunctionsOptions): Promise<StandardClientFunctions> => {
  const enabledServers = servers.filter((server) => server.enabled);
  if (enabledServers.length === 0) {
    return {};
  }

  const runtimeServerEntries = makeRuntimeServerEntries(enabledServers);
  const runtimeServers = runtimeServerEntries.map(({ runtimeServer }) => runtimeServer);
  const toolResponse = await listTools(runtimeServers, abortSignal);
  const serverByRuntimeId = new Map(
    runtimeServerEntries.map(({ originalServer, runtimeServer }) => [runtimeServer.id, originalServer]),
  );
  const functions: StandardClientFunctions = {};

  for (const serverTools of toolResponse.servers) {
    const server = serverByRuntimeId.get(serverTools.serverId);
    if (!server) {
      continue;
    }

    for (const tool of serverTools.tools) {
      const functionName = toMcpFunctionName(serverTools.serverId, tool.name);
      functions[functionName] = {
        declaration: {
          name: functionName,
          description: buildDescription(serverTools.serverName, tool),
          parameters: toGeminiSchema(tool.inputSchema),
        },
        handler: async (args, options) => ({
          response: await callTool(server, tool.name, isRecord(args) ? args : {}, options?.abortSignal ?? abortSignal),
        }),
      };
    }
  }

  return functions;
};
