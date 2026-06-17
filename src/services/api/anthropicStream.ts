import type { AnthropicStreamEvent } from './anthropicTypes';

export const parseAnthropicSseEvents = (buffer: string): { events: AnthropicStreamEvent[]; rest: string } => {
  const events: AnthropicStreamEvent[] = [];
  let searchStart = 0;
  let boundaryIndex = buffer.indexOf('\n\n', searchStart);

  while (boundaryIndex !== -1) {
    const rawEvent = buffer.slice(searchStart, boundaryIndex);
    const dataLines = rawEvent
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (dataLines && dataLines !== '[DONE]') {
      try {
        events.push(JSON.parse(dataLines) as AnthropicStreamEvent);
      } catch {
        // skip malformed
      }
    }

    searchStart = boundaryIndex + 2;
    boundaryIndex = buffer.indexOf('\n\n', searchStart);
  }

  return { events, rest: buffer.slice(searchStart) };
};

export const readAnthropicStreamEvents = async (
  response: Response,
  abortSignal: AbortSignal,
  onEvent: (event: AnthropicStreamEvent) => void,
): Promise<void> => {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done || abortSignal.aborted) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const parsed = parseAnthropicSseEvents(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      onEvent(event);
      if (event.type === 'message_stop') {
        return;
      }
    }
  }

  const tail = decoder.decode();
  if (tail) {
    buffer += tail.replace(/\r\n/g, '\n');
  }
  const parsed = parseAnthropicSseEvents(`${buffer}\n\n`);
  for (const event of parsed.events) {
    onEvent(event);
  }
};
