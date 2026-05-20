import { DEFAULT_OPENAI_COMPATIBLE_BASE_URL } from '@/utils/apiProxyUrl';

const normalizeOpenAICompatibleBaseUrl = (baseUrl?: string | null): string =>
  (baseUrl?.trim() || DEFAULT_OPENAI_COMPATIBLE_BASE_URL).replace(/\/+$/, '');

export const buildOpenAICompatibleChatCompletionsUrl = (baseUrl?: string | null): string =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/chat/completions`;

export const buildOpenAICompatibleModelsUrl = (baseUrl?: string | null): string =>
  `${normalizeOpenAICompatibleBaseUrl(baseUrl)}/models`;
