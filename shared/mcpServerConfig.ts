export type McpServerTransport = 'stdio' | 'http';
export type McpServerAuthType = 'none' | 'bearer' | 'customHeaders';

export interface McpServerAuthConfig {
  type: McpServerAuthType;
  token?: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpServerTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  auth?: McpServerAuthConfig;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
};

export const sanitizeStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const sanitizeMcpAuth = (value: unknown): McpServerAuthConfig | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.type === 'none' || value.type === 'customHeaders') {
    return { type: value.type };
  }

  if (value.type === 'bearer') {
    const token = typeof value.token === 'string' ? value.token.trim() : '';
    return {
      type: 'bearer',
      ...(token ? { token } : {}),
    };
  }

  return undefined;
};

export const isValidMcpHttpUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};
