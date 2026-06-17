import { describe, expect, it } from 'vitest';
import { buildAnthropicMessagesUrl, buildAnthropicModelsUrl, normalizeAnthropicBaseUrl } from './anthropicUrls';

describe('anthropicUrls', () => {
  it('normalizes by trimming trailing slashes', () => {
    expect(normalizeAnthropicBaseUrl('https://api.anthropic.com/')).toBe('https://api.anthropic.com');
  });

  it('falls back to default base url when empty', () => {
    expect(normalizeAnthropicBaseUrl(null)).toBe('https://api.anthropic.com');
    expect(normalizeAnthropicBaseUrl('  ')).toBe('https://api.anthropic.com');
  });

  it('builds messages url with /v1/messages', () => {
    expect(buildAnthropicMessagesUrl('https://api.anthropic.com')).toBe('https://api.anthropic.com/v1/messages');
  });

  it('builds models url with /v1/models', () => {
    expect(buildAnthropicModelsUrl('https://api.anthropic.com')).toBe('https://api.anthropic.com/v1/models');
  });
});
