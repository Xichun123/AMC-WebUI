import { describe, expect, it } from 'vitest';
import { asAnthropicChatConfig, mapAnthropicUsage } from './anthropicTypes';

describe('anthropicTypes', () => {
  it('extracts config from unknown, defaulting to empty', () => {
    expect(asAnthropicChatConfig(null)).toEqual({});
    expect(asAnthropicChatConfig({ baseUrl: 'https://x' })).toEqual({ baseUrl: 'https://x' });
  });

  it('maps usage input/output tokens to Gemini-style usage', () => {
    const usage = mapAnthropicUsage({ input_tokens: 10, output_tokens: 5 });
    expect(usage).toEqual({
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    });
  });

  it('returns undefined when usage missing', () => {
    expect(mapAnthropicUsage(undefined)).toBeUndefined();
  });
});
