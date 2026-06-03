import { act, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppViewModel } from '@/hooks/app/useApp';
import { renderHook } from '@/test/render/renderer';
import { createAppSettings, createChatAreaProviderValue, createChatRuntimeApp } from '@/test/chat-area/fixtures';
import { ChatRuntimeProvider, useChatHeaderRuntime } from './chat-runtime/ChatRuntimeContext';
import { CHAT_INPUT_TEXTAREA_SELECTOR } from '@/constants/storageKeys';

const mockStores = vi.hoisted(() => {
  const ui = {
    isSettingsModalOpen: false,
    setIsSettingsModalOpen: vi.fn(),
    isPreloadedMessagesModalOpen: false,
    setIsPreloadedMessagesModalOpen: vi.fn(),
    isLogViewerOpen: false,
    setIsLogViewerOpen: vi.fn(),
  };
  const chat = {
    setCommandedInput: vi.fn(),
  };
  const useChatStoreMock = Object.assign((selector: (state: typeof chat) => unknown) => selector(chat), {
    getState: () => chat,
  });

  return {
    ui,
    chat,
    useChatStoreMock,
  };
});

vi.mock('@/stores/uiStore', () => ({
  useUIStore: (selector: (state: typeof mockStores.ui) => unknown) => selector(mockStores.ui),
}));

vi.mock('@/stores/chatStore', () => ({
  useChatStore: mockStores.useChatStoreMock,
}));

vi.mock('@/utils/keyboardShortcuts', () => ({
  getShortcutDisplay: vi.fn(() => 'shortcut'),
}));

const renderChatHeaderRuntime = (app: AppViewModel) =>
  renderHook(() => useChatHeaderRuntime(), {
    wrapper: ({ children }: PropsWithChildren) => <ChatRuntimeProvider app={app}>{children}</ChatRuntimeProvider>,
  });

type BuildAppOverrides = Omit<Partial<AppViewModel>, 'chatState'> & {
  chatState?: Partial<AppViewModel['chatState']>;
};

const buildApp = (overrides: BuildAppOverrides = {}) => {
  const { chatState: chatStateOverrides, ...appOverrides } = overrides;
  const appSettings = createAppSettings({
    isOpenAICompatibleApiEnabled: true,
    apiMode: 'openai-compatible',
    modelId: 'gemini-3-flash-preview',
    openaiCompatibleModelId: 'gpt-5.5',
    openaiCompatibleModels: [
      { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
    ],
  });
  const handleSelectModelInHeader = vi.fn();
  const setAppSettings = vi.fn<AppViewModel['setAppSettings']>();
  const app = createChatRuntimeApp(
    createChatAreaProviderValue({
      header: {
        availableModels: [{ id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' }],
        currentModelName: 'GPT-5.5',
        isPipSupported: false,
      },
      input: {
        appSettings,
        currentChatSettings: { modelId: 'gemini-3-flash-preview' },
        onSelectModel: handleSelectModelInHeader,
      },
    }),
  );

  return {
    ...app,
    appSettings,
    setAppSettings,
    getCurrentModelDisplayName: vi.fn(() => 'GPT-5.5'),
    ...appOverrides,
    chatState: {
      ...app.chatState,
      handleSelectModelInHeader,
      ...chatStateOverrides,
    },
  } satisfies AppViewModel;
};

describe('chat runtime values', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('shows API-configured OpenAI-compatible models in the header while OpenAI mode is active', () => {
    const app = buildApp();
    const { result, unmount } = renderChatHeaderRuntime(app);
    const header = result.current;

    expect(header.availableModels).toEqual([
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', apiMode: 'gemini-native' },
      { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true, apiMode: 'openai-compatible' },
      { id: 'gpt-4.1', name: 'GPT-4.1', apiMode: 'openai-compatible' },
    ]);
    expect(header.selectedModelId).toBe('gpt-5.5');
    expect(header.currentModelName).toBe('GPT-5.5');

    act(() => {
      header.onSelectModel('gpt-4.1');
    });

    expect(app.chatState.handleSelectModelInHeader).not.toHaveBeenCalled();
    expect(app.setAppSettings).toHaveBeenCalledOnce();
    const updater = vi.mocked(app.setAppSettings).mock.calls[0][0];
    expect(typeof updater).toBe('function');
    if (typeof updater !== 'function') {
      throw new Error('Expected setAppSettings to receive an updater function');
    }
    expect(updater(app.appSettings)).toEqual(
      expect.objectContaining({
        apiMode: 'openai-compatible',
        modelId: 'gemini-3-flash-preview',
        openaiCompatibleModelId: 'gpt-4.1',
      }),
    );

    unmount();
  });

  it('shows API-configured OpenAI-compatible models in the header while Gemini-native mode is active', () => {
    const app = buildApp({
      appSettings: {
        ...createAppSettings(),
        isOpenAICompatibleApiEnabled: true,
        apiMode: 'gemini-native',
        modelId: 'gemini-3-flash-preview',
        openaiCompatibleModelId: 'gpt-5.5',
        openaiCompatibleModels: [{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }],
      },
      getCurrentModelDisplayName: vi.fn(() => 'Gemini 3 Flash Preview'),
    });
    const { result, unmount } = renderChatHeaderRuntime(app);
    const header = result.current;

    expect(header.availableModels).toEqual([
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', apiMode: 'gemini-native' },
      { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true, apiMode: 'openai-compatible' },
    ]);
    expect(header.selectedModelId).toBe('gemini-3-flash-preview');

    act(() => {
      header.onSelectModel('gemini-3.1-pro-preview');
    });

    expect(app.chatState.handleSelectModelInHeader).toHaveBeenCalledWith('gemini-3.1-pro-preview');
    expect(app.setAppSettings).not.toHaveBeenCalled();

    act(() => {
      header.onSelectModel('gpt-5.5');
    });

    expect(app.setAppSettings).toHaveBeenCalledOnce();
    const switchToOpenAI = vi.mocked(app.setAppSettings).mock.calls[0][0];
    expect(typeof switchToOpenAI).toBe('function');
    if (typeof switchToOpenAI !== 'function') {
      throw new Error('Expected setAppSettings to receive an updater function');
    }
    expect(switchToOpenAI(app.appSettings)).toEqual(
      expect.objectContaining({
        apiMode: 'openai-compatible',
        openaiCompatibleModelId: 'gpt-5.5',
      }),
    );

    unmount();
  });

  it('focuses the chat input after selecting an OpenAI-compatible model from Gemini-native mode', () => {
    vi.useFakeTimers();
    const previousFocus = document.createElement('button');
    const textarea = document.createElement('textarea');
    textarea.setAttribute('data-chat-input-textarea', 'true');
    document.body.append(previousFocus, textarea);
    previousFocus.focus();

    const app = buildApp({
      appSettings: {
        ...createAppSettings(),
        isOpenAICompatibleApiEnabled: true,
        apiMode: 'gemini-native',
        modelId: 'gemini-3-flash-preview',
        openaiCompatibleModelId: 'gpt-5.5',
        openaiCompatibleModels: [{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }],
      },
      getCurrentModelDisplayName: vi.fn(() => 'Gemini 3 Flash Preview'),
    });
    const { result, unmount } = renderChatHeaderRuntime(app);

    try {
      act(() => {
        result.current.onSelectModel('gpt-5.5');
        vi.runAllTimers();
      });

      expect(document.querySelector(CHAT_INPUT_TEXTAREA_SELECTOR)).toBe(textarea);
      expect(document.activeElement).toBe(textarea);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('keeps OpenAI-compatible models hidden while the provider switch is off', () => {
    const app = buildApp({
      appSettings: {
        ...createAppSettings(),
        isOpenAICompatibleApiEnabled: false,
        apiMode: 'gemini-native',
        modelId: 'gemini-3-flash-preview',
        openaiCompatibleModelId: 'gpt-5.5',
        openaiCompatibleModels: [{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }],
      },
      getCurrentModelDisplayName: vi.fn(() => 'Gemini 3 Flash Preview'),
    });
    const { result, unmount } = renderChatHeaderRuntime(app);
    const header = result.current;

    expect(header.availableModels).toEqual([
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', apiMode: 'gemini-native' },
    ]);
    expect(header.selectedModelId).toBe('gemini-3-flash-preview');

    act(() => {
      header.onSelectModel('gpt-5.5');
    });

    expect(app.setAppSettings).not.toHaveBeenCalled();
    expect(app.chatState.handleSelectModelInHeader).toHaveBeenCalledWith('gpt-5.5');

    unmount();
  });

  it('switches back to Gemini-native mode when selecting a Gemini model from OpenAI mode', () => {
    const app = buildApp();
    const { result, unmount } = renderChatHeaderRuntime(app);
    const header = result.current;

    act(() => {
      header.onSelectModel('gemini-3-flash-preview');
    });

    expect(app.chatState.handleSelectModelInHeader).toHaveBeenCalledWith('gemini-3-flash-preview');
    expect(app.setAppSettings).toHaveBeenCalledOnce();
    const switchToGemini = vi.mocked(app.setAppSettings).mock.calls[0][0];
    expect(typeof switchToGemini).toBe('function');
    if (typeof switchToGemini !== 'function') {
      throw new Error('Expected setAppSettings to receive an updater function');
    }
    expect(switchToGemini(app.appSettings)).toEqual(
      expect.objectContaining({
        apiMode: 'gemini-native',
        modelId: 'gemini-3-flash-preview',
        openaiCompatibleModelId: 'gpt-5.5',
      }),
    );

    unmount();
  });
});
