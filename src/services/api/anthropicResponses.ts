import type { AnthropicResponsePayload } from './anthropicTypes';

export const readAnthropicErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text();
  if (!text) {
    return `Anthropic request failed with status ${response.status}`;
  }
  try {
    const parsed = JSON.parse(text) as AnthropicResponsePayload;
    return parsed.error?.message || text;
  } catch {
    return text;
  }
};

export const extractAnthropicMessageText = (payload: AnthropicResponsePayload): string => {
  if (!Array.isArray(payload.content)) {
    return '';
  }
  return payload.content
    .map((block) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('');
};
