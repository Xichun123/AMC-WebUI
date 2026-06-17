import { describe, expect, it } from 'vitest';
import type { ChatHistoryItem } from '@/types';
import { buildAnthropicRequestBody } from './anthropicMessages';

const history: ChatHistoryItem[] = [
  { role: 'user', parts: [{ text: 'Hello' }] },
  { role: 'model', parts: [{ text: 'Hi there' }] },
];

describe('buildAnthropicRequestBody', () => {
  it('extracts system instruction to top-level system field', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      history,
      [{ text: 'How are you?' }],
      { systemInstruction: 'Be helpful', temperature: 0.5 },
      'user',
      false,
    );
    expect(body.system).toBe('Be helpful');
    expect(body.temperature).toBe(0.5);
  });

  it('maps history roles: model->assistant, user stays user', () => {
    const body = buildAnthropicRequestBody(
      'claude-sonnet-4-6',
      history,
      [{ text: 'How are you?' }],
      {},
      'user',
      false,
    ) as { messages: Array<{ role: string }> };
    const roles = body.messages.map((m) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });

  it('omits system field when no system instruction', () => {
    const body = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', false);
    expect(body.system).toBeUndefined();
  });

  it('includes stream flag and max_tokens', () => {
    const bodyStream = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', true);
    expect(bodyStream.stream).toBe(true);
    expect(bodyStream.max_tokens).toBeGreaterThan(0);
    const bodyNoStream = buildAnthropicRequestBody('m', [], [{ text: 'hi' }], {}, 'user', false);
    expect(bodyNoStream.stream).toBe(false);
  });
});
