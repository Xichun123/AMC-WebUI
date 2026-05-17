export type GeminiBackendFlavor = 'aistudio' | 'vertex';

export interface ApiServerConfig {
  port: number;
  backendFlavor: GeminiBackendFlavor;
  geminiApiBase: string;
  geminiApiKey?: string;
  vertex?: VertexBackendConfig;
  allowedOrigins: string[];
}

export interface VertexBackendConfig {
  projectId: string;
  location: string;
}

interface EnvLike {
  [key: string]: string | undefined;
}

const DEFAULT_PORT = 3001;
const DEFAULT_GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const DEFAULT_VERTEX_LOCATION = 'us-central1';

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

export function loadConfig(env: EnvLike = process.env): ApiServerConfig {
  const backendFlavor = parseBackendFlavor(env.GEMINI_BACKEND);

  const baseConfig: Omit<ApiServerConfig, 'vertex' | 'backendFlavor'> = {
    port: parsePort(env.PORT),
    geminiApiBase: env.GEMINI_API_BASE?.trim() || DEFAULT_GEMINI_API_BASE,
    geminiApiKey: env.GEMINI_API_KEY?.trim() || undefined,
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
  };

  if (backendFlavor === 'vertex') {
    return {
      ...baseConfig,
      backendFlavor,
      vertex: loadVertexConfig(env),
    };
  }

  return { ...baseConfig, backendFlavor };
}
