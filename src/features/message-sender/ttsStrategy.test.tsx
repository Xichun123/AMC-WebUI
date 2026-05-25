import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTranslator } from '@/i18n/translations';
import { createAppSettings, createChatSettings } from '@/test/data/factories';

const { generateSpeechMock, showNotificationMock } = vi.hoisted(() => ({
  generateSpeechMock: vi.fn(),
  showNotificationMock: vi.fn(),
}));

vi.mock('@/services/api/generation/audioApi', () => ({
  generateSpeechApi: generateSpeechMock,
}));

vi.mock('@/features/audio/audioProcessing', () => ({
  pcmBase64ToWavUrl: vi.fn(() => 'blob:wav-url'),
}));

vi.mock('@/utils/browserCompletionFeedback', () => ({
  showNotification: showNotificationMock,
  playCompletionSound: vi.fn(),
}));

vi.mock('@/utils/chat/session', () => ({
  performOptimisticSessionUpdate: vi.fn((prev: unknown) => prev),
  createMessage: (role: 'user' | 'model', content: string, options: Record<string, unknown> = {}) => ({
    id: options.id ?? `${role}-message`,
    role,
    content,
    timestamp: new Date('2026-04-21T00:00:00.000Z'),
    ...options,
  }),
  generateSessionTitle: vi.fn(() => 'Generated Title'),
}));

vi.mock('@/utils/chat/ids', () => ({
  generateUniqueId: vi.fn(() => 'generated-session'),
}));

import { sendTtsMessage } from './ttsStrategy';

describe('ttsStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSpeechMock.mockResolvedValue('pcm-audio');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  });

  it('uses translated TTS error prefix and notification text', async () => {
    const updateAndPersistSessions = vi.fn();
    const setActiveSessionId = vi.fn();
    const runMessageLifecycle = vi.fn(async ({ execute }) => execute());

    await act(async () => {
      await sendTtsMessage({
        keyToUse: 'api-key',
        activeSessionId: 'session-1',
        generationId: 'generation-1',
        abortController: new AbortController(),
        appSettings: createAppSettings({
          generateQuadImages: false,
          isCompletionSoundEnabled: false,
          isCompletionNotificationEnabled: true,
        }),
        currentChatSettings: createChatSettings({
          modelId: 'gemini-2.5-flash-preview-tts',
          ttsVoice: 'Kore',
        }),
        text: '你好',
        t: getTranslator('zh'),
        updateAndPersistSessions,
        setActiveSessionId,
        runMessageLifecycle,
      });
    });

    expect(runMessageLifecycle).toHaveBeenCalledWith(expect.objectContaining({ errorPrefix: '语音生成错误' }));
    expect(showNotificationMock).toHaveBeenCalledWith(
      '音频已生成',
      expect.objectContaining({
        body: '文本转语音音频已生成。',
      }),
    );
  });
});
