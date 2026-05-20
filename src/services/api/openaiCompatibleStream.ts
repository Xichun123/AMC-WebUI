import type { OpenAIResponsePayload } from './openaiCompatibleTypes';

const parseSseDataLines = (buffer: string): { events: string[]; rest: string } => {
  const events: string[] = [];
  let searchStart = 0;
  let boundaryIndex = buffer.indexOf('\n\n', searchStart);

  while (boundaryIndex !== -1) {
    const rawEvent = buffer.slice(searchStart, boundaryIndex);
    const data = rawEvent
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (data) {
      events.push(data);
    }

    searchStart = boundaryIndex + 2;
    boundaryIndex = buffer.indexOf('\n\n', searchStart);
  }

  return { events, rest: buffer.slice(searchStart) };
};

export const readOpenAICompatibleStreamEvents = async (
  response: Response,
  abortSignal: AbortSignal,
  onEvent: (payload: OpenAIResponsePayload) => void,
): Promise<void> => {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done || abortSignal.aborted) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const parsed = parseSseDataLines(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      if (event === '[DONE]') {
        return;
      }
      onEvent(JSON.parse(event) as OpenAIResponsePayload);
    }
  }

  const tail = decoder.decode();
  if (tail) {
    buffer += tail.replace(/\r\n/g, '\n');
  }
  const parsed = parseSseDataLines(`${buffer}\n\n`);
  for (const event of parsed.events) {
    if (event !== '[DONE]') {
      onEvent(JSON.parse(event) as OpenAIResponsePayload);
    }
  }
};
