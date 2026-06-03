import { DEFAULT_OPENAI_COMPATIBLE_BASE_URL } from '@/utils/apiProxyUrl';

type OpenAICompatibleBaseUrlWarning = 'chat-completions-endpoint' | 'models-endpoint';

const normalizeOpenAICompatibleBaseUrl = (baseUrl?: string | null): string =>
  (baseUrl?.trim() || DEFAULT_OPENAI_COMPATIBLE_BASE_URL).replace(/\/+$/, '');

const getOpenAICompatibleBaseUrlPath = (baseUrl?: string | null): string =>
  normalizeOpenAICompatibleBaseUrl(baseUrl).split(/[?#]/, 1)[0].replace(/\/+$/, '').toLowerCase();

export const getOpenAICompatibleBaseUrlWarning = (baseUrl?: string | null): OpenAICompatibleBaseUrlWarning | null => {
  const baseUrlPath = getOpenAICompatibleBaseUrlPath(baseUrl);

  if (baseUrlPath.endsWith('/chat/completions')) {
    return 'chat-completions-endpoint';
  }

  if (baseUrlPath.endsWith('/models')) {
    return 'models-endpoint';
  }

  return null;
};

export const buildOpenAICompatibleChatCompletionsUrl = (baseUrl?: string | null): string =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/chat/completions`;

export const buildOpenAICompatibleModelsUrl = (baseUrl?: string | null): string =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/models`;
