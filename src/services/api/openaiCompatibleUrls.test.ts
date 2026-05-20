import { describe, expect, it } from 'vitest';
import { buildOpenAICompatibleChatCompletionsUrl, buildOpenAICompatibleModelsUrl } from './openaiCompatibleUrls';

describe('openaiCompatibleUrls', () => {
  it('appends chat completions and models paths to the configured API root', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(buildOpenAICompatibleModelsUrl('https://generativelanguage.googleapis.com/v1beta/openai/')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/models',
    );
  });

  it('uses the default OpenAI-compatible API root when the configured root is blank', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('  ')).toBe('https://api.openai.com/v1/chat/completions');
    expect(buildOpenAICompatibleModelsUrl(null)).toBe('https://api.openai.com/v1/models');
  });
});
