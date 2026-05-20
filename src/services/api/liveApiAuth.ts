import type { GoogleGenAI } from '@google/genai';
import type { AppSettings } from '@/types';
import { getClient } from './apiClient';
import { resolveLiveClientBaseUrl } from './geminiApiBaseUrl';
import type { GeminiClientHttpOptions } from './geminiApiVersion';

export class LiveApiAuthConfigurationError extends Error {
  code: 'MISSING_API_KEY';

  constructor(code: 'MISSING_API_KEY', message: string) {
    super(message);
    this.name = 'LiveApiAuthConfigurationError';
    this.code = code;
  }
}

export const getLiveApiClient = async (
  appSettings: Pick<AppSettings, 'useCustomApiConfig' | 'useApiProxy' | 'apiProxyUrl'>,
  httpOptions?: GeminiClientHttpOptions,
  apiKeyForLiveConnection?: string | null,
): Promise<GoogleGenAI> => {
  const apiKey = apiKeyForLiveConnection?.trim();

  if (!apiKey) {
    throw new LiveApiAuthConfigurationError('MISSING_API_KEY', 'Live API requires a browser API key.');
  }

  return getClient(apiKey, resolveLiveClientBaseUrl(appSettings), httpOptions);
};
