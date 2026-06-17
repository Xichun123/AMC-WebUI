import { describe, expect, it } from 'vitest';
import { parseAnthropicSseEvents } from './anthropicStream';

describe('parseAnthropicSseEvents', () => {
  it('parses event + data pairs into typed events', () => {
    const buffer = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}',
      '',
      '',
    ].join('\n');
    const { events, rest } = parseAnthropicSseEvents(buffer);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hi' },
    });
    expect(rest).toBe('');
  });

  it('keeps partial event in rest buffer', () => {
    const buffer = 'event: content_block_delta\ndata: {"type":"content_block_delta"';
    const { events, rest } = parseAnthropicSseEvents(buffer);
    expect(events).toHaveLength(0);
    expect(rest).toBe(buffer);
  });

  it('handles multiple events in one buffer', () => {
    const buffer = [
      'event: ping',
      'data: {"type":"ping"}',
      '',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
      '',
    ].join('\n');
    const { events } = parseAnthropicSseEvents(buffer);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('ping');
    expect(events[1].type).toBe('message_stop');
  });
});
