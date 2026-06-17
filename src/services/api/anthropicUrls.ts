export const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export const normalizeAnthropicBaseUrl = (baseUrl?: string | null): string =>
  (baseUrl?.trim() || DEFAULT_ANTHROPIC_BASE_URL).replace(/\/+$/, '');

export const buildAnthropicMessagesUrl = (baseUrl?: string | null): string =>
  `${normalizeAnthropicBaseUrl(baseUrl)}/v1/messages`;

export const buildAnthropicModelsUrl = (baseUrl?: string | null): string =>
  `${normalizeAnthropicBaseUrl(baseUrl)}/v1/models`;
