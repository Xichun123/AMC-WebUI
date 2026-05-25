import { renderHook } from '@/test/render/renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@/constants/settingsDefaults';
import type { SavedChatSession } from '@/types';
import { useAutoTitling } from './useAutoTitling';

const { generateTitleApiMock, getGeminiKeyForRequestMock } = vi.hoisted(() => ({
  generateTitleApiMock: vi.fn(),
  getGeminiKeyForRequestMock: vi.fn(),
}));

vi.mock('@/services/api/generation/textApi', () => ({
  generateTitleApi: generateTitleApiMock,
}));

vi.mock('@/utils/apiKeySelection', () => ({
  getGeminiKeyForRequest: getGeminiKeyForRequestMock,
}));

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createLogServiceMockModule();
});

const createSession = (overrides: Partial<SavedChatSession> = {}): SavedChatSession => ({
  id: 'session-1',
  title: 'New Chat',
  timestamp: 1,
  settings: {
    ...DEFAULT_APP_SETTINGS,
    modelId: 'gemini-3-flash-preview',
  },
  messages: [
    {
      id: 'message-user',
      role: 'user',
      content: 'Explain routing',
      timestamp: new Date('2026-05-09T00:00:00.000Z'),
    },
    {
      id: 'message-model',
      role: 'model',
      content: 'Routing decides which handler receives a request.',
      timestamp: new Date('2026-05-09T00:00:01.000Z'),
    },
  ],
  ...overrides,
});

describe('useAutoTitling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getGeminiKeyForRequestMock.mockReturnValue({ key: 'gemini-key', isNewKey: true });
    generateTitleApiMock.mockResolvedValue('Routing Basics');
  });

  it('uses a Gemini key instead of the OpenAI sticky key while OpenAI-compatible mode is active', async () => {
    const updateAndPersistSessions = vi.fn();
    const sessionKeyMapRef = {
      current: new Map([['session-1', 'openai-key']]),
    };

    const { unmount } = renderHook(() =>
      useAutoTitling({
        appSettings: {
          ...DEFAULT_APP_SETTINGS,
          isOpenAICompatibleApiEnabled: true,
          apiMode: 'openai-compatible',
          apiKey: 'gemini-key',
          openaiCompatibleApiKey: 'openai-key',
        },
        activeChat: createSession(),
        updateAndPersistSessions,
        language: 'en',
        generatingTitleSessionIds: new Set(),
        setGeneratingTitleSessionIds: vi.fn(),
        sessionKeyMapRef,
      }),
    );

    await vi.waitFor(() => {
      expect(generateTitleApiMock).toHaveBeenCalledWith(
        'gemini-key',
        'Explain routing',
        'Routing decides which handler receives a request.',
        'en',
      );
    });
    expect(getGeminiKeyForRequestMock).toHaveBeenCalled();
    unmount();
  });

  it('does not repeatedly retry an unchanged placeholder title when a Gemini key is unavailable', async () => {
    const prompt = '请使用LiveArtifacts将提供的信息整理成结构化响应式HTML产物';
    const activeChat = createSession({
      title: prompt,
      messages: [
        {
          id: 'message-user',
          role: 'user',
          content: prompt,
          timestamp: new Date('2026-05-09T00:00:00.000Z'),
        },
        {
          id: 'message-model',
          role: 'model',
          content: 'Done.',
          timestamp: new Date('2026-05-09T00:00:01.000Z'),
        },
      ],
    });
    let generatingTitleSessionIds = new Set<string>();
    const setGeneratingTitleSessionIds = vi.fn((updater: React.SetStateAction<Set<string>>) => {
      generatingTitleSessionIds = typeof updater === 'function' ? updater(generatingTitleSessionIds) : updater;
    });

    getGeminiKeyForRequestMock.mockReturnValue({ error: 'API Key not configured.' });

    const { rerender, unmount } = renderHook(() =>
      useAutoTitling({
        appSettings: DEFAULT_APP_SETTINGS,
        activeChat,
        updateAndPersistSessions: vi.fn(),
        language: 'zh',
        generatingTitleSessionIds,
        setGeneratingTitleSessionIds,
      }),
    );

    await vi.waitFor(() => {
      expect(getGeminiKeyForRequestMock).toHaveBeenCalledTimes(1);
    });

    rerender();

    expect(getGeminiKeyForRequestMock).toHaveBeenCalledTimes(1);
    expect(generateTitleApiMock).not.toHaveBeenCalled();
    unmount();
  });
});
