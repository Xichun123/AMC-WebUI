import { act } from 'react';
import { setupProviderTestRenderer } from '@/test/render/providerRenderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChatInputTestProvider,
  createProviderValue,
  getChatInputHarnessMocks,
  type ChatAreaProviderValue,
  resetChatInputHarnessState,
  setTextareaValue,
} from '@/test/chat-input/harness';
import { ChatInput } from './ChatInput';

const { mockTextApi } = getChatInputHarnessMocks();

describe('ChatInput composer actions', () => {
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
    vi.unstubAllGlobals();
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
});
