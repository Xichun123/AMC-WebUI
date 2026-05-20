import { act } from 'react';
import { setupProviderTestRenderer } from '@/test/providerTestUtils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChatInputTestProvider,
  createProviderValue,
  dispatchKeyDown,
  getChatInputHarnessMocks,
  type ChatAreaProviderValue,
  resetChatInputHarnessState,
  setTextareaValue,
} from '@/test/chatInputHarness';
import { type UploadedFile } from '@/types';
import { ChatInput } from './ChatInput';

const { mockChatStoreState, mockChatStoreSubscribers, mockLiveApiState, mockModelCapabilities, mockTextApi } =
  getChatInputHarnessMocks();

describe('ChatInput', () => {
  const renderer = setupProviderTestRenderer({ providers: { language: 'en' } });

  const renderChatInput = (providerValue: ChatAreaProviderValue) => {
    renderer.root.render(
      <ChatInputTestProvider value={providerValue}>
        <ChatInput />
      </ChatInputTestProvider>,
    );
  };

  beforeEach(() => {
    localStorage.clear();
    resetChatInputHarnessState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('preserves user edits after commanded input pre-fills edit mode text', async () => {
    const providerValue = createProviderValue({
      id: 1,
      mode: 'replace',
      text: 'Original message',
    });

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const valueProbe = renderer.container.querySelector<HTMLElement>('[data-testid="chat-input-value"]');
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe('Original message');
    expect(valueProbe?.textContent).toBe('Original message');

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Original message updated');
    });

    expect(textarea?.value).toBe('Original message updated');
    expect(valueProbe?.textContent).toBe('Original message updated');
  });

  it('focuses replacement commands at the bottom of the filled input', async () => {
    vi.useFakeTimers();
    try {
      const replacementText = 'Use Live Artifacts to organize this:\n\n';
      const providerValue = createProviderValue({
        id: 1,
        mode: 'replace',
        text: replacementText,
      });

      await act(async () => {
        renderChatInput(providerValue);
      });

      const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
      expect(textarea).not.toBeNull();

      if (!textarea) {
        return;
      }

      Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 480 });

      await act(async () => {
        vi.runOnlyPendingTimers();
      });

      expect(textarea.value).toBe(replacementText);
      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe(replacementText.length);
      expect(textarea.selectionEnd).toBe(replacementText.length);
      expect(textarea.scrollTop).toBe(480);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends slash-prefixed text when it does not match an executable command', async () => {
    const onSendMessage = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = onSendMessage;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, '/api/v1 docs');
      dispatchKeyDown(textarea, 'Enter');
    });

    expect(onSendMessage).toHaveBeenCalledWith('/api/v1 docs', { isFastMode: false, files: undefined });
  });

  it('sends exact command text with trailing whitespace instead of auto-executing it', async () => {
    const onSendMessage = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = onSendMessage;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, '/help ');
      dispatchKeyDown(textarea, 'Enter');
    });

    expect(onSendMessage).toHaveBeenCalledWith('/help ', { isFastMode: false, files: undefined });
    expect(providerValue.input.onClearChat).not.toHaveBeenCalled();
  });

  it('does not execute slash commands while IME composition is active', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, '/clear');
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      dispatchKeyDown(textarea, 'Enter');
    });

    expect(providerValue.input.onClearChat).not.toHaveBeenCalled();
    expect(textarea?.value).toBe('/clear');
  });

  it('does not submit while IME key events use process key code', async () => {
    const onSendMessage = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = onSendMessage;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'ni');
      dispatchKeyDown(textarea, 'Enter', { keyCode: 229, which: 229 });
    });

    expect(onSendMessage).not.toHaveBeenCalled();
    expect(textarea?.value).toBe('ni');
  });

  it('sends Live text turns with selected attachments through client content', async () => {
    const onAddUserMessage = vi.fn();
    const selectedFiles: UploadedFile[] = [
      {
        id: 'image-file',
        name: 'diagram.png',
        type: 'image/png',
        size: 128,
        uploadState: 'active',
        fileUri: 'files/diagram',
      },
    ];
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.selectedFiles = selectedFiles;
    providerValue.input.onAddUserMessage = onAddUserMessage;
    providerValue.input.currentChatSettings.modelId = 'gemini-3.1-flash-live-preview';
    mockModelCapabilities.value = {
      ...mockModelCapabilities.value,
      isNativeAudioModel: true,
      isGemini3: true,
    };

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Describe this');
      dispatchKeyDown(textarea, 'Enter');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLiveApiState.connect).toHaveBeenCalled();
    expect(mockLiveApiState.sendContent).toHaveBeenCalledWith([
      {
        fileData: { mimeType: 'image/png', fileUri: 'files/diagram' },
        mediaResolution: { level: 'MEDIA_RESOLUTION_MEDIUM' },
      },
      { text: 'Describe this' },
    ]);
    expect(mockLiveApiState.sendText).not.toHaveBeenCalled();
    expect(onAddUserMessage).toHaveBeenCalledWith('Describe this', selectedFiles);
  });

  it('starts screen sharing and connects Live when the session is not connected', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.currentChatSettings.modelId = 'gemini-3.1-flash-live-preview';
    mockModelCapabilities.value = {
      ...mockModelCapabilities.value,
      isNativeAudioModel: true,
      isGemini3: true,
    };

    await act(async () => {
      renderChatInput(providerValue);
    });

    await act(async () => {
      renderer.container.querySelector<HTMLButtonElement>('[data-testid="live-screen-button"]')?.click();
      await Promise.resolve();
    });

    expect(mockLiveApiState.startScreenShare).toHaveBeenCalledTimes(1);
    expect(mockLiveApiState.connect).toHaveBeenCalledTimes(1);
  });

  it('starts the camera without reconnecting when Live is already connected', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.currentChatSettings.modelId = 'gemini-3.1-flash-live-preview';
    mockLiveApiState.isConnected = true;
    mockModelCapabilities.value = {
      ...mockModelCapabilities.value,
      isNativeAudioModel: true,
      isGemini3: true,
    };

    await act(async () => {
      renderChatInput(providerValue);
    });

    await act(async () => {
      renderer.container.querySelector<HTMLButtonElement>('[data-testid="live-camera-button"]')?.click();
      await Promise.resolve();
    });

    expect(mockLiveApiState.startCamera).toHaveBeenCalledTimes(1);
    expect(mockLiveApiState.connect).not.toHaveBeenCalled();
  });

  it('passes Live status through the focused status view hook', async () => {
    const providerValue = createProviderValue(null);
    mockLiveApiState.isConnected = true;
    mockLiveApiState.isReconnecting = true;
    mockLiveApiState.error = 'Live reconnecting';

    await act(async () => {
      renderChatInput(providerValue);
    });

    expect(renderer.container.querySelector('[data-testid="live-connected"]')?.textContent).toBe('true');
    expect(renderer.container.querySelector('[data-testid="live-reconnecting"]')?.textContent).toBe('true');
    expect(renderer.container.querySelector('[data-testid="live-error"]')?.textContent).toBe('Live reconnecting');
  });

  it('queues the next draft while loading and auto-sends it after loading finishes', async () => {
    const onSendMessage = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = true;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = onSendMessage;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const queueButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="queue-button"]');
    expect(textarea).not.toBeNull();
    expect(queueButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Queue this next');
    });

    expect(queueButton?.disabled).toBe(false);

    await act(async () => {
      queueButton?.click();
    });

    expect(renderer.container.querySelector('[data-testid="queued-card"]')?.textContent).toContain('Queue this next');
    expect(renderer.container.querySelector('[data-testid="queued-title"]')?.textContent).toBe('Next up');
    expect(textarea?.value).toBe('');

    const completedProviderValue = {
      ...providerValue,
      input: {
        ...providerValue.input,
        isLoading: false,
      },
    } satisfies ChatAreaProviderValue;

    await act(async () => {
      renderChatInput(completedProviderValue);
    });

    expect(onSendMessage).toHaveBeenCalledWith('Queue this next', { isFastMode: false, files: undefined });
  });

  it('queues the next draft when pressing Enter while loading and auto-sends it after loading finishes', async () => {
    const onSendMessage = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = true;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = onSendMessage;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Queue this via Enter');
      dispatchKeyDown(textarea, 'Enter');
    });

    expect(renderer.container.querySelector('[data-testid="queued-card"]')?.textContent).toContain(
      'Queue this via Enter',
    );
    expect(textarea?.value).toBe('');

    const completedProviderValue = {
      ...providerValue,
      input: {
        ...providerValue.input,
        isLoading: false,
      },
    } satisfies ChatAreaProviderValue;

    await act(async () => {
      renderChatInput(completedProviderValue);
    });

    expect(onSendMessage).toHaveBeenCalledWith('Queue this via Enter', { isFastMode: false, files: undefined });
  });

  it('preserves a newer draft when a queued message auto-sends', async () => {
    const onSendMessage = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = true;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = onSendMessage;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const queueButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="queue-button"]');
    expect(textarea).not.toBeNull();
    expect(queueButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Queue this next');
      queueButton?.click();
    });

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Draft after queueing');
    });

    const completedProviderValue = {
      ...providerValue,
      input: {
        ...providerValue.input,
        isLoading: false,
      },
    } satisfies ChatAreaProviderValue;

    await act(async () => {
      renderChatInput(completedProviderValue);
    });

    expect(onSendMessage).toHaveBeenCalledWith('Queue this next', { isFastMode: false, files: undefined });
    expect(textarea?.value).toBe('Draft after queueing');
  });

  it('keeps a queued message bound to its original session before auto-sending', async () => {
    const sessionOneSend = vi.fn();
    const sessionTwoSend = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = true;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onSendMessage = sessionOneSend;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const queueButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="queue-button"]');
    expect(textarea).not.toBeNull();
    expect(queueButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Queue for session one');
      queueButton?.click();
    });

    const sessionTwoProviderValue = {
      ...providerValue,
      messageList: {
        ...providerValue.messageList,
        activeSessionId: 'session-2',
      },
      input: {
        ...providerValue.input,
        activeSessionId: 'session-2',
        isLoading: false,
        onSendMessage: sessionTwoSend,
      },
    } satisfies ChatAreaProviderValue;

    await act(async () => {
      renderChatInput(sessionTwoProviderValue);
    });

    expect(sessionTwoSend).not.toHaveBeenCalled();
    expect(renderer.container.querySelector('[data-testid="queued-card"]')).toBeNull();

    const completedOriginalSession = {
      ...providerValue,
      input: {
        ...providerValue.input,
        isLoading: false,
        onSendMessage: sessionOneSend,
      },
    } satisfies ChatAreaProviderValue;

    await act(async () => {
      renderChatInput(completedOriginalSession);
    });

    expect(sessionOneSend).toHaveBeenCalledWith('Queue for session one', {
      isFastMode: false,
      files: undefined,
    });
  });

  it('restores queued draft text back into the composer when editing the queued card', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = true;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const queueButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="queue-button"]');
    expect(textarea).not.toBeNull();
    expect(queueButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Bring this back');
      queueButton?.click();
    });

    expect(renderer.container.querySelector('[data-testid="queued-card"]')).not.toBeNull();

    await act(async () => {
      renderer.container.querySelector<HTMLButtonElement>('[data-testid="queued-edit"]')?.click();
    });

    expect(renderer.container.querySelector('[data-testid="queued-card"]')).toBeNull();
    expect(textarea?.value).toBe('Bring this back');
  });

  it('moves text file content into the composer and removes only that file from the selection', async () => {
    const setSelectedFiles = vi.fn();
    const providerValue = createProviderValue(null);
    const selectedFiles: UploadedFile[] = [
      {
        id: 'text-file',
        name: 'prompt.txt',
        type: 'text/plain',
        size: 24,
        uploadState: 'active',
        textContent: 'Prompt from attachment',
      },
      {
        id: 'image-file',
        name: 'diagram.png',
        type: 'image/png',
        size: 128,
        uploadState: 'active',
      },
    ];
    providerValue.input.selectedFiles = selectedFiles;
    providerValue.input.setSelectedFiles = setSelectedFiles;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const moveButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="move-file-text-file"]');

    expect(textarea).not.toBeNull();
    expect(moveButton).not.toBeNull();

    await act(async () => {
      moveButton?.click();
    });

    expect(textarea?.value).toBe('Prompt from attachment');
    expect(setSelectedFiles).toHaveBeenCalledTimes(1);

    const removeConvertedFile = setSelectedFiles.mock.calls[0]?.[0] as
      | ((files: Array<{ id: string }>) => Array<{ id: string }>)
      | undefined;

    expect(removeConvertedFile).toBeTypeOf('function');
    expect(removeConvertedFile?.([{ id: 'text-file' }, { id: 'image-file' }])).toEqual([{ id: 'image-file' }]);
  });

  it('translates composer text using the configured target language', async () => {
    mockTextApi.translateTextApi.mockResolvedValueOnce('Bonjour');
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      translationTargetLanguage: 'French',
      showInputTranslationButton: true,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const translateButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="translate-button"]');
    expect(textarea).not.toBeNull();
    expect(translateButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Hello');
    });

    await act(async () => {
      translateButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockTextApi.translateTextApi).toHaveBeenCalledWith('api-key', 'Hello', 'French', undefined);
    expect(textarea?.value).toBe('Bonjour');
  });

  it('includes translation API error details when composer translation fails', async () => {
    mockTextApi.translateTextApi.mockRejectedValueOnce(new Error('model overloaded'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setAppFileError = vi.fn();
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      translationTargetLanguage: 'French',
      showInputTranslationButton: true,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.setAppFileError = setAppFileError;

    try {
      await act(async () => {
        renderChatInput(providerValue);
      });

      const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
      const translateButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="translate-button"]');

      await act(async () => {
        if (!textarea) {
          return;
        }

        setTextareaValue(textarea, 'Hello');
      });

      await act(async () => {
        translateButton?.click();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(setAppFileError).toHaveBeenLastCalledWith('Translation failed: model overloaded');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('translates composer text using the configured input translation model', async () => {
    mockTextApi.translateTextApi.mockResolvedValueOnce('Bonjour');
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      translationTargetLanguage: 'French',
      inputTranslationModelId: 'gemini-custom-input-translator',
      showInputTranslationButton: true,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const translateButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="translate-button"]');

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Hello');
    });

    await act(async () => {
      translateButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockTextApi.translateTextApi).toHaveBeenCalledWith(
      'api-key',
      'Hello',
      'French',
      'gemini-custom-input-translator',
    );
  });

  it('hides the composer translate button when the setting is disabled', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      showInputTranslationButton: false,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    expect(renderer.container.querySelector('[data-testid="translate-button"]')).toBeNull();
  });

  it('hides the composer translate button by default', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      showInputTranslationButton: undefined,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    expect(renderer.container.querySelector('[data-testid="translate-button"]')).toBeNull();
  });

  it('appends clipboard text to the composer from the paste action', async () => {
    const readText = vi.fn(async () => ' clipboard text');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    });
    const providerValue = createProviderValue(null);
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const pasteButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="paste-button"]');

    expect(textarea).not.toBeNull();
    expect(pasteButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Existing');
    });

    await act(async () => {
      pasteButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(readText).toHaveBeenCalledTimes(1);
    expect(textarea?.value).toBe('Existing clipboard text');
    expect(document.activeElement).toBe(textarea);
  });

  it('processes clipboard images from the paste action without inserting image filename text', async () => {
    const imageBlob = new Blob(['fake-png'], { type: 'image/png' });
    const getType = vi.fn(async () => imageBlob);
    const read = vi.fn(async () => [{ types: ['image/png'], getType }]);
    const readText = vi.fn(async () => 'PixPin_2026-05-09_16-05-36.png');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read, readText },
    });
    const onProcessFiles = vi.fn(async (_files: FileList | File[]) => {});
    const providerValue = createProviderValue(null);
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onProcessFiles = onProcessFiles;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const pasteButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="paste-button"]');

    expect(textarea).not.toBeNull();
    expect(pasteButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, '');
    });

    await act(async () => {
      pasteButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(getType).toHaveBeenCalledWith('image/png');
    expect(readText).not.toHaveBeenCalled();
    expect(onProcessFiles).toHaveBeenCalledTimes(1);
    const files = onProcessFiles.mock.calls[0]?.[0] as File[];
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0]?.name).toBe('clipboard-image.png');
    expect(files[0]?.type).toBe('image/png');
    expect(textarea?.value).toBe('');
    expect(document.activeElement).toBe(textarea);
  });

  it('processes local clipboard image fallback when browser clipboard image data is unavailable', async () => {
    const read = vi.fn(async () => []);
    const readText = vi.fn(async () => 'PixPin_2026-05-09_16-05-36.png');
    const fetchMock = vi.fn(async () => {
      return new Response(new Blob(['local-png'], { type: 'image/png' }), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'x-clipboard-file-name': 'PixPin_2026-05-09_16-05-36.png',
        },
      });
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read, readText },
    });
    vi.stubGlobal('fetch', fetchMock);
    const onProcessFiles = vi.fn(async (_files: FileList | File[]) => {});
    const providerValue = createProviderValue(null);
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onProcessFiles = onProcessFiles;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const pasteButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="paste-button"]');

    expect(textarea).not.toBeNull();
    expect(pasteButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, '');
    });

    await act(async () => {
      pasteButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(readText).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/local-clipboard-image', { cache: 'no-store' });
    expect(onProcessFiles).toHaveBeenCalledTimes(1);
    const files = onProcessFiles.mock.calls[0]?.[0] as File[];
    expect(files).toHaveLength(1);
    expect(files[0]).toBeInstanceOf(File);
    expect(files[0]?.name).toBe('PixPin_2026-05-09_16-05-36.png');
    expect(files[0]?.type).toBe('image/png');
    expect(textarea?.value).toBe('');
    expect(document.activeElement).toBe(textarea);
  });

  it('checks the local clipboard image fallback when clipboard text is empty', async () => {
    const read = vi.fn(async () => []);
    const readText = vi.fn(async () => '');
    const fetchMock = vi.fn(async () => {
      return new Response(new Blob(['local-png'], { type: 'image/png' }), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'x-clipboard-file-name': 'clipboard-image.png',
        },
      });
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read, readText },
    });
    vi.stubGlobal('fetch', fetchMock);
    const onProcessFiles = vi.fn(async (_files: FileList | File[]) => {});
    const providerValue = createProviderValue(null);
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.onProcessFiles = onProcessFiles;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const pasteButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="paste-button"]');

    expect(textarea).not.toBeNull();
    expect(pasteButton).not.toBeNull();

    await act(async () => {
      pasteButton?.click();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(readText).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/local-clipboard-image', { cache: 'no-store' });
    expect(onProcessFiles).toHaveBeenCalledTimes(1);
    const files = onProcessFiles.mock.calls[0]?.[0] as File[];
    expect(files[0]?.name).toBe('clipboard-image.png');
    expect(files[0]?.type).toBe('image/png');
  });

  it('hides the paste button when the interface setting is disabled', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      showInputPasteButton: false,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    expect(renderer.container.querySelector('[data-testid="paste-button"]')).toBeNull();
  });

  it('clears the composer from the clear input action when enabled', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      showInputClearButton: true,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const clearButton = renderer.container.querySelector<HTMLButtonElement>('[data-testid="clear-input-button"]');

    expect(textarea).not.toBeNull();
    expect(clearButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Text to clear');
    });

    await act(async () => {
      clearButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(textarea?.value).toBe('');
    expect(document.activeElement).toBe(textarea);
  });

  it('shows the clear input button by default', async () => {
    const providerValue = createProviderValue(null);
    providerValue.input.appSettings = {
      ...providerValue.input.appSettings,
      showInputClearButton: undefined,
    };
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;

    await act(async () => {
      renderChatInput(providerValue);
    });

    expect(renderer.container.querySelector('[data-testid="clear-input-button"]')).not.toBeNull();
  });

  it('does not auto-send a pending message when an attachment finishes as failed', async () => {
    const onSendMessage = vi.fn();
    const setAppFileError = vi.fn();
    const processingFile: UploadedFile = {
      id: 'processing-file',
      name: 'large.pdf',
      type: 'application/pdf',
      size: 4096,
      uploadState: 'processing_api',
      isProcessing: true,
    };
    const failedFile: UploadedFile = {
      ...processingFile,
      uploadState: 'failed',
      isProcessing: false,
      error: 'Backend processing failed.',
    };
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.selectedFiles = [processingFile];
    providerValue.input.onSendMessage = onSendMessage;
    providerValue.input.setAppFileError = setAppFileError;
    mockChatStoreState.selectedFiles = [processingFile];

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Summarize this file');
      dispatchKeyDown(textarea, 'Enter');
    });

    expect(onSendMessage).not.toHaveBeenCalled();

    await act(async () => {
      const previousState = { selectedFiles: [processingFile] };
      const nextState = { selectedFiles: [failedFile] };
      mockChatStoreState.selectedFiles = nextState.selectedFiles;
      mockChatStoreSubscribers.forEach((subscriber) => subscriber(nextState, previousState));
    });

    expect(onSendMessage).not.toHaveBeenCalled();
    expect(setAppFileError).toHaveBeenCalledWith(
      'Attachment upload failed. Remove the failed file or upload it again before sending.',
    );
  });

  it('cancels a pending automatic send while an attachment is still uploading', async () => {
    const onSendMessage = vi.fn();
    const processingFile: UploadedFile = {
      id: 'processing-file',
      name: 'large.pdf',
      type: 'application/pdf',
      size: 4096,
      uploadState: 'processing_api',
      isProcessing: true,
    };
    const activeFile: UploadedFile = {
      ...processingFile,
      uploadState: 'active',
      isProcessing: false,
    };
    const providerValue = createProviderValue(null);
    providerValue.input.isLoading = false;
    providerValue.input.isEditing = false;
    providerValue.input.editMode = 'resend';
    providerValue.input.editingMessageId = null;
    providerValue.input.selectedFiles = [processingFile];
    providerValue.input.onSendMessage = onSendMessage;
    mockChatStoreState.selectedFiles = [processingFile];

    await act(async () => {
      renderChatInput(providerValue);
    });

    const textarea = renderer.container.querySelector<HTMLTextAreaElement>('[data-testid="chat-input-textarea"]');
    const cancelPendingButton = renderer.container.querySelector<HTMLButtonElement>(
      '[data-testid="cancel-pending-upload-send"]',
    );

    expect(textarea).not.toBeNull();
    expect(cancelPendingButton).not.toBeNull();

    await act(async () => {
      if (!textarea) {
        return;
      }

      setTextareaValue(textarea, 'Summarize this file');
      dispatchKeyDown(textarea, 'Enter');
    });

    expect(onSendMessage).not.toHaveBeenCalled();

    await act(async () => {
      cancelPendingButton?.click();
    });

    await act(async () => {
      const previousState = { selectedFiles: [processingFile] };
      const nextState = { selectedFiles: [activeFile] };
      mockChatStoreState.selectedFiles = nextState.selectedFiles;
      mockChatStoreSubscribers.forEach((subscriber) => subscriber(nextState, previousState));
    });

    expect(onSendMessage).not.toHaveBeenCalled();
  });
});
