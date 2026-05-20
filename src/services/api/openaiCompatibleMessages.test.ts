import { describe, expect, it } from 'vitest';
import { buildOpenAICompatibleRequestBody } from './openaiCompatibleMessages';

describe('openaiCompatibleMessages', () => {
  it('maps Gemini chat history and current parts to OpenAI-compatible messages', () => {
    expect(
      buildOpenAICompatibleRequestBody(
        'gemini-3-flash-preview',
        [{ role: 'model', parts: [{ text: 'previous answer' }] }],
        [{ text: 'current question' }],
        { systemInstruction: 'Be concise.', temperature: 0.4, topP: 0.9 },
        'user',
        false,
      ),
    ).toEqual({
      model: 'gemini-3-flash-preview',
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'assistant', content: 'previous answer' },
        { role: 'user', content: 'current question' },
      ],
      stream: false,
      temperature: 0.4,
      top_p: 0.9,
    });
  });

  it('maps inline image and audio parts to OpenAI-compatible content items', () => {
    const body = buildOpenAICompatibleRequestBody(
      'gpt-4o-mini',
      [],
      [
        { text: 'describe these' },
        { inlineData: { mimeType: 'image/png', data: 'image-data' } },
        { inlineData: { mimeType: 'audio/wav', data: 'audio-data' } },
      ],
      {},
      'user',
      true,
    );

    expect(body).toEqual({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'describe these' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,image-data' } },
            { type: 'input_audio', input_audio: { data: 'audio-data', format: 'wav' } },
          ],
        },
      ],
      stream: true,
      stream_options: { include_usage: true },
    });
  });
});
