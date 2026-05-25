export type GeminiBackendFlavor = 'aistudio' | 'vertex';

export interface ApiServerConfig {
  port: number;
  backendFlavor: GeminiBackendFlavor;
  geminiApiBase: string;
  geminiApiKey?: string;
  vertex?: VertexBackendConfig;
  gcs?: GcsConfig;
  allowedOrigins: string[];
  siteAuth: SiteAuthConfig;
  enableMcpStdio: boolean;
  enableMcpPrivateHttp: boolean;
}

export interface VertexBackendConfig {
  projectId: string;
  location: string;
}

export interface GcsConfig {
  bucketName: string;
  objectPrefix: string;
  maxFileBytes: number;
}

interface EnvLike {
  [key: string]: string | undefined;
}

const DEFAULT_PORT = 3001;
const DEFAULT_GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const DEFAULT_VERTEX_LOCATION = 'us-central1';
const DEFAULT_GCS_OBJECT_PREFIX = 'amc-files/';
const DEFAULT_GCS_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_SITE_AUTH_SESSION_DAYS = 7;

export interface SiteAuthUserConfig {
  username: string;
  passwordHash: string;
}

export interface SiteAuthConfig {
  enabled: boolean;
  users: SiteAuthUserConfig[];
  secret?: string;
  sessionDays: number;
}

function parsePort(port: string | undefined): number {
  if (!port) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(port, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }

  return parsed;
}

function parseAllowedOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return [];
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function parseBooleanFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

function parseBackendFlavor(value: string | undefined): GeminiBackendFlavor {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'vertex') {
    return 'vertex';
  }
  return 'aistudio';
}

function loadVertexConfig(env: EnvLike): VertexBackendConfig {
  const projectId = env.GCP_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID is required when GEMINI_BACKEND=vertex.');
  }

  const location = env.GCP_LOCATION?.trim() || DEFAULT_VERTEX_LOCATION;
  return { projectId, location };
}

function normalizeObjectPrefix(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_GCS_OBJECT_PREFIX;
  }

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  return withoutLeadingSlash.endsWith('/') ? withoutLeadingSlash : `${withoutLeadingSlash}/`;
}

function parseMaxFileBytes(value: string | undefined): number {
  if (!value) {
    return DEFAULT_GCS_MAX_FILE_BYTES;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_GCS_MAX_FILE_BYTES;
  }

  return parsed;
}

function parseSiteAuthUsers(rawUsers: string | undefined): SiteAuthUserConfig[] {
  const trimmed = rawUsers?.trim();
  if (!trimmed) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `SITE_AUTH_USERS_JSON must be a JSON array of { username, passwordHash } entries: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error('SITE_AUTH_USERS_JSON must be a JSON array.');
  }

  const users = parsed.map((entry, index): SiteAuthUserConfig => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`SITE_AUTH_USERS_JSON entry ${index + 1} must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const username = typeof record.username === 'string' ? record.username.trim() : '';
    const passwordHash = typeof record.passwordHash === 'string' ? record.passwordHash.trim() : '';
    if (!username || !passwordHash) {
      throw new Error(`SITE_AUTH_USERS_JSON entry ${index + 1} requires username and passwordHash.`);
    }

    return { username, passwordHash };
  });

  const seen = new Set<string>();
  for (const user of users) {
    if (seen.has(user.username)) {
      throw new Error(`SITE_AUTH_USERS_JSON contains a duplicate username: ${user.username}`);
    }
    seen.add(user.username);
  }

  return users;
}

function parseSessionDays(value: string | undefined): number {
  if (!value) {
    return DEFAULT_SITE_AUTH_SESSION_DAYS;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SITE_AUTH_SESSION_DAYS;
}

function loadSiteAuthConfig(env: EnvLike): SiteAuthConfig {
  const users = parseSiteAuthUsers(env.SITE_AUTH_USERS_JSON);
  if (!users.length) {
    return { enabled: false, users: [], sessionDays: DEFAULT_SITE_AUTH_SESSION_DAYS };
  }

  const secret = env.SITE_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('SITE_AUTH_SECRET is required when SITE_AUTH_USERS_JSON contains users.');
  }

  return {
    enabled: true,
    users,
    secret,
    sessionDays: parseSessionDays(env.SITE_AUTH_SESSION_DAYS),
  };
}

function loadGcsConfig(env: EnvLike): GcsConfig | undefined {
  const bucketName = env.GCS_BUCKET?.trim();
  if (!bucketName) {
    return undefined;
  }

  return {
    bucketName,
    objectPrefix: normalizeObjectPrefix(env.GCS_OBJECT_PREFIX),
    maxFileBytes: parseMaxFileBytes(env.GCS_MAX_FILE_BYTES),
  };
}

export function loadConfig(env: EnvLike = process.env): ApiServerConfig {
  const backendFlavor = parseBackendFlavor(env.GEMINI_BACKEND);

  const baseConfig: Omit<ApiServerConfig, 'vertex' | 'backendFlavor' | 'gcs'> = {
    port: parsePort(env.PORT),
    geminiApiBase: env.GEMINI_API_BASE?.trim() || DEFAULT_GEMINI_API_BASE,
    geminiApiKey: env.GEMINI_API_KEY?.trim() || undefined,
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    siteAuth: loadSiteAuthConfig(env),
    enableMcpStdio: parseBooleanFlag(env.ENABLE_MCP_STDIO),
    enableMcpPrivateHttp: parseBooleanFlag(env.ENABLE_MCP_PRIVATE_HTTP),
  };

  if (backendFlavor === 'vertex') {
    return {
      ...baseConfig,
      backendFlavor,
      vertex: loadVertexConfig(env),
      gcs: loadGcsConfig(env),
    };
  }

  return { ...baseConfig, backendFlavor };
}
