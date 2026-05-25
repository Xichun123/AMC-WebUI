import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/modelUsageStats', () => ({
  calculateTokenStats: () => ({
    promptTokens: 0,
    cachedPromptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    thoughtTokens: 0,
    toolUsePromptTokens: 0,
  }),
}));

vi.mock('@/i18n/translations', () => ({
  getTranslator: () => (key: string) => key,
}));

import { createChatSettings } from '@/test/data/factories';
import { finalizeMessages } from './processors';

describe('finalizeMessages', () => {
  it('preserves files that were attached before finalizing the generated message', () => {
    const generationStartTime = new Date('2026-04-25T01:00:00.000Z');
    const existingFile = {
      id: 'plot-file',
      name: 'generated-plot.png',
      type: 'image/png',
      size: 12,
      dataUrl: 'blob:plot',
      uploadState: 'active' as const,
    };

    const { updatedMessages } = finalizeMessages({
      messages: [
        {
          id: 'model-message',
          role: 'model',
          content: '已生成图片。',
          timestamp: generationStartTime,
          generationStartTime,
          isLoading: true,
          files: [existingFile],
        },
      ],
      generationStartTime,
      newModelMessageIds: new Set(['model-message']),
      currentChatSettings: createChatSettings(),
      language: 'zh',
      firstContentPartTime: generationStartTime,
    });

    expect(updatedMessages[0]?.files).toEqual([existingFile]);
  });

  it('preserves empty internal tool model messages because their api parts rebuild context', () => {
    const generationStartTime = new Date('2026-04-25T01:00:00.000Z');
    const { updatedMessages } = finalizeMessages({
      messages: [
        {
          id: 'user-message',
          role: 'user',
          content: 'Run Python.',
          timestamp: new Date('2026-04-25T00:59:59.000Z'),
        },
        {
          id: 'internal-tool-call',
          role: 'model',
          content: '',
          timestamp: new Date('2026-04-25T01:00:00.100Z'),
          isInternalToolMessage: true,
          toolParentMessageId: 'model-message',
          apiParts: [{ functionCall: { id: 'call-1', name: 'run_local_python', args: { code: 'print(42)' } } }],
        },
        {
          id: 'internal-tool-response',
          role: 'user',
          content: '',
          timestamp: new Date('2026-04-25T01:00:00.200Z'),
          isInternalToolMessage: true,
          toolParentMessageId: 'model-message',
          apiParts: [
            {
              functionResponse: {
                id: 'call-1',
                name: 'run_local_python',
                response: { result: { output: '42' } },
              },
            },
          ],
        },
        {
          id: 'model-message',
          role: 'model',
          content: 'The answer is 42.',
          timestamp: generationStartTime,
          generationStartTime,
          isLoading: true,
        },
      ],
      generationStartTime,
      newModelMessageIds: new Set(['model-message']),
      currentChatSettings: createChatSettings(),
      language: 'zh',
      firstContentPartTime: generationStartTime,
    });

    expect(updatedMessages.map((message) => message.id)).toEqual([
      'user-message',
      'internal-tool-call',
      'internal-tool-response',
      'model-message',
    ]);
  });
});
