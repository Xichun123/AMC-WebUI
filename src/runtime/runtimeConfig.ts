import type { AppSettings } from '@/types/settings';

type BackendFlavor = 'aistudio' | 'vertex';

type RuntimeConfigKey =
  | 'serverManagedApi'
  | 'useCustomApiConfig'
  | 'useApiProxy'
  | 'apiProxyUrl'
  | 'projectUrl'
  | 'pyodideBaseUrl'
  | 'backendFlavor';

type RuntimeConfigShape = Partial<Record<RuntimeConfigKey, unknown>>;

declare global {
  interface Window {
    __AMC_RUNTIME_CONFIG__?: RuntimeConfigShape;
  }
}

function readBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value === null) {
    return null;
  }

  return undefined;
}

function getRuntimeConfig(): RuntimeConfigShape | undefined {
  return typeof window !== 'undefined' ? window.__AMC_RUNTIME_CONFIG__ : undefined;
}

export function getPyodideBaseUrl(): string | null {
  return readNullableString(getRuntimeConfig()?.pyodideBaseUrl) ?? null;
}

export function getBackendFlavor(): BackendFlavor {
  const value = getRuntimeConfig()?.backendFlavor;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'vertex') {
    return 'vertex';
  }
  return 'aistudio';
}

export function getRuntimeConfigAppSettingsOverrides(): Partial<
  Pick<AppSettings, 'serverManagedApi' | 'useCustomApiConfig' | 'useApiProxy' | 'apiProxyUrl'>
> {
  const runtimeConfig = getRuntimeConfig();

  if (!runtimeConfig) {
    return {};
  }

  const overrides: Partial<
    Pick<AppSettings, 'serverManagedApi' | 'useCustomApiConfig' | 'useApiProxy' | 'apiProxyUrl'>
  > = {};

  const serverManagedApi = readBooleanValue(runtimeConfig.serverManagedApi);
  if (serverManagedApi !== undefined) {
    overrides.serverManagedApi = serverManagedApi;
  }

  // Vertex backend authenticates via the API container's Service Account, so the browser
  // never holds an API key. Force server-managed mode regardless of RUNTIME_SERVER_MANAGED_API
  // so the BYOK key check is skipped.
  if (getBackendFlavor() === 'vertex') {
    overrides.serverManagedApi = true;
  }

  const useCustomApiConfig = readBooleanValue(runtimeConfig.useCustomApiConfig);
  if (useCustomApiConfig !== undefined) {
    overrides.useCustomApiConfig = useCustomApiConfig;
  }

  const useApiProxy = readBooleanValue(runtimeConfig.useApiProxy);
  if (useApiProxy !== undefined) {
    overrides.useApiProxy = useApiProxy;
  }

  const apiProxyUrl = readNullableString(runtimeConfig.apiProxyUrl);
  if (apiProxyUrl !== undefined) {
    overrides.apiProxyUrl = apiProxyUrl;
  }

  return overrides;
}
