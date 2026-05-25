const MCP_FUNCTION_PREFIX = 'mcp_';
const MAX_FUNCTION_NAME_LENGTH = 64;
const HASH_LENGTH = 8;

const sanitizeNamePart = (value: string): string =>
  value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();

const hashName = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(HASH_LENGTH, '0').slice(0, HASH_LENGTH);
};

export const toMcpFunctionName = (serverId: string, toolName: string): string => {
  const hash = hashName(`${serverId}\0${toolName}`);
  const safeServerId = sanitizeNamePart(serverId) || 'server';
  const safeToolName = sanitizeNamePart(toolName) || 'tool';
  const suffix = `_${hash}`;
  const base = `${MCP_FUNCTION_PREFIX}${safeServerId}_${safeToolName}`;
  const maxBaseLength = MAX_FUNCTION_NAME_LENGTH - suffix.length;

  return `${base.slice(0, maxBaseLength).replace(/_+$/g, '')}${suffix}`;
};
