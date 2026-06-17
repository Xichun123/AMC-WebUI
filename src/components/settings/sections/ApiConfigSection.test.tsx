import { act, type ComponentProps } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';
import { setupStoreStateReset } from '@/test/stores/reset';
import type { AppSettings } from '@/types';
import { SERVER_MANAGED_API_KEY } from '@/utils/apiKeySelection';
import { createDefaultThirdPartyApiSettings } from '@/utils/thirdPartyApiProviders';
import { ApiConfigSection } from './ApiConfigSection';

const {
  getClientMock,
  generateContentMock,
  sendOpenAICompatibleMessageNonStreamMock,
  sendAnthropicMessageNonStreamMock,
} = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  generateContentMock: vi.fn(),
  sendOpenAICompatibleMessageNonStreamMock: vi.fn(),
  sendAnthropicMessageNonStreamMock: vi.fn(),
}));

vi.mock('@/hooks/useDevice', () => ({
  useResponsiveValue: vi.fn(() => 18),
}));

vi.mock('@/services/api/apiClient', () => ({
  getClient: getClientMock,
}));

vi.mock('@/services/api/openaiCompatibleApi', () => ({
  sendOpenAICompatibleMessageNonStream: sendOpenAICompatibleMessageNonStreamMock,
}));

vi.mock('@/services/api/anthropicApi', () => ({
  sendAnthropicMessageNonStream: sendAnthropicMessageNonStreamMock,
}));

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createLogServiceMockModule();
});

describe('ApiConfigSection', () => {
  const renderer = setupTestRenderer();
  setupStoreStateReset();
  const settingsFixture: AppSettings = {
    ...useSettingsStore.getState().appSettings,
  };

  const createApiConfigProps = (
    overrides: Partial<ComponentProps<typeof ApiConfigSection>> = {},
  ): ComponentProps<typeof ApiConfigSection> => ({
    useCustomApiConfig: true,
    setUseCustomApiConfig: vi.fn(),
    apiKey: null,
    setApiKey: vi.fn(),
    apiProxyUrl: null,
    setApiProxyUrl: vi.fn(),
    useApiProxy: false,
    setUseApiProxy: vi.fn(),
    serverManagedApi: false,
    settings: settingsFixture,
    onUpdate: vi.fn(),
    ...overrides,
  });

  const renderApiConfigSection = async (
    overrides: Partial<ComponentProps<typeof ApiConfigSection>> & { language?: 'en' | 'zh' } = {},
  ) => {
    const { language = 'en', ...props } = overrides;

    await act(async () => {
      useSettingsStore.setState({ language });
      renderer.root.render(<ApiConfigSection {...createApiConfigProps(props)} />);
    });
  };

  const withOpenaiProvider = (overrides: {
    apiKey?: string | null;
    baseUrl?: string | null;
    modelId?: string;
    models?: Array<{ id: string; name: string; isPinned?: boolean }>;
  }): Partial<AppSettings> => {
    const defaults = createDefaultThirdPartyApiSettings();
    return {
      isThirdPartyApiEnabled: true,
      apiMode: 'third-party',
      thirdPartyApi: {
        activeProvider: 'openai',
        providers: {
          ...defaults.providers,
          openai: {
            apiKey: overrides.apiKey ?? null,
            baseUrl: overrides.baseUrl ?? defaults.providers.openai.baseUrl,
            modelId: overrides.modelId ?? defaults.providers.openai.modelId,
            models: overrides.models ?? defaults.providers.openai.models,
            protocol: 'openai-compatible' as const,
          },
        },
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    generateContentMock.mockResolvedValue({});
    sendOpenAICompatibleMessageNonStreamMock.mockResolvedValue(undefined);
    sendAnthropicMessageNonStreamMock.mockResolvedValue(undefined);
    getClientMock.mockReturnValue({
      models: {
        generateContent: generateContentMock,
      },
    });
  });

  afterEach(() => {
    delete window.__AMC_RUNTIME_CONFIG__;
    vi.restoreAllMocks();
  });

  it('allows running connection test in server-managed mode without a browser-held key', async () => {
    await renderApiConfigSection({
      apiProxyUrl: 'https://proxy.example.com/v1beta',
      useApiProxy: true,
      serverManagedApi: true,
    });

    expect(renderer.container.textContent).not.toContain('API & Connections');

    const testButton = Array.from(renderer.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Test Connection'),
    );

    expect(testButton).toBeDefined();
    expect(testButton?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      testButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(getClientMock).toHaveBeenCalled();
    });
    expect(getClientMock).toHaveBeenCalledWith(SERVER_MANAGED_API_KEY, 'https://proxy.example.com/v1beta');

    await vi.waitFor(() => {
      expect(generateContentMock).toHaveBeenCalledWith({
        model: 'gemini-3-flash-preview',
        contents: 'Hello',
      });
    });
  });

  it('updates translated labels when the global language changes', async () => {
    await renderApiConfigSection();

    expect(renderer.container.textContent).not.toContain('API & Connections');
    expect(renderer.container.textContent).toContain('Test Connection');
    expect(renderer.container.textContent).toContain('File Transfer Method');
    expect(renderer.container.textContent).toContain('API Provider');
    expect(renderer.container.textContent).toContain('Gemini Official API');
    expect(renderer.container.textContent).toContain('Third-Party API');

    act(() => {
      useSettingsStore.setState({ language: 'zh' });
    });

    expect(renderer.container.textContent).not.toContain('API 与连接');
    expect(renderer.container.textContent).toContain('测试连通性');
    expect(renderer.container.textContent).toContain('文件传输方式');
    expect(renderer.container.textContent).toContain('API 提供方');
    expect(renderer.container.textContent).toContain('Gemini 官方接口');
    expect(renderer.container.textContent).toContain('第三方接口');
  });

  it('renders a single provider selector and enables third-party mode from it', async () => {
    const onUpdate = vi.fn();

    await renderApiConfigSection({ onUpdate });

    const providerSelector = renderer.container.querySelector('[role="group"][aria-label="API Provider"]');
    const openaiProviderButton = Array.from(renderer.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Third-Party API',
    );

    expect(providerSelector).not.toBeNull();
    expect(renderer.container.querySelector('#openai-compatible-api-enabled-toggle')).toBeNull();
    expect(openaiProviderButton).toBeDefined();

    await act(async () => {
      openaiProviderButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onUpdate).toHaveBeenCalledWith('isThirdPartyApiEnabled', true);
    expect(onUpdate).toHaveBeenCalledWith('apiMode', 'third-party');
  });

  it('returns to Gemini provider from the same selector and hides third-party settings', async () => {
    const onUpdate = vi.fn();

    await renderApiConfigSection({
      settings: { ...settingsFixture, ...withOpenaiProvider({}) },
      onUpdate,
    });

    const geminiProviderButton = Array.from(renderer.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Gemini Official API',
    );

    expect(renderer.container.querySelector('#openai-compatible-api-enabled-toggle')).toBeNull();
    expect(geminiProviderButton).toBeDefined();
    expect(renderer.container.textContent).toContain('Provider');

    await act(async () => {
      geminiProviderButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onUpdate).toHaveBeenCalledWith('isThirdPartyApiEnabled', false);
    expect(onUpdate).toHaveBeenCalledWith('apiMode', 'gemini-native');
  });

  it('tests the third-party openai endpoint with the active provider key when third-party mode is selected', async () => {
    await renderApiConfigSection({
      apiKey: 'gemini-key',
      settings: {
        ...settingsFixture,
        ...withOpenaiProvider({
          apiKey: 'openai-compatible-key',
          baseUrl: 'https://api.openai.com/v1',
          modelId: 'gpt-5.5',
        }),
      },
    });

    const testButton = Array.from(renderer.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Test Connection'),
    );

    await act(async () => {
      testButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(getClientMock).not.toHaveBeenCalled();
    expect(sendOpenAICompatibleMessageNonStreamMock).toHaveBeenCalledWith(
      'openai-compatible-key',
      'gpt-5.5',
      [],
      [{ text: 'Hello' }],
      {
        baseUrl: 'https://api.openai.com/v1',
        temperature: 0,
      },
      expect.any(AbortSignal),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('shows the active provider base url in the third-party settings panel', async () => {
    await renderApiConfigSection({
      settings: {
        ...settingsFixture,
        ...withOpenaiProvider({ baseUrl: 'https://gateway.example.com/v1' }),
      },
    });

    const baseUrlInput = renderer.container.querySelector('#third-party-base-url-input') as HTMLInputElement | null;
    expect(baseUrlInput).not.toBeNull();
    expect(baseUrlInput?.value).toBe('https://gateway.example.com/v1');
  });

  it('edits the active provider api key without overwriting the Gemini api key', async () => {
    const setApiKey = vi.fn();
    const onUpdate = vi.fn();

    await renderApiConfigSection({
      apiKey: 'gemini-key',
      setApiKey,
      settings: {
        ...settingsFixture,
        ...withOpenaiProvider({ apiKey: null, baseUrl: 'https://api.openai.com/v1' }),
      },
      onUpdate,
    });

    const apiKeyInput = renderer.container.querySelector('#api-key-input') as HTMLTextAreaElement | null;
    expect(apiKeyInput).not.toBeNull();

    await act(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      descriptor?.set?.call(apiKeyInput, 'sk-openai');
      apiKeyInput!.dispatchEvent(new Event('input', { bubbles: true }));
      apiKeyInput!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setApiKey).not.toHaveBeenCalled();
    // The active provider api key is written through onUpdate with the full thirdPartyApi object.
    const thirdPartyUpdate = onUpdate.mock.calls.find(([key]) => key === 'thirdPartyApi');
    expect(thirdPartyUpdate).toBeDefined();
    const updatedSettings = thirdPartyUpdate![1] as AppSettings['thirdPartyApi'];
    expect(updatedSettings.providers.openai.apiKey).toBe('sk-openai');
  });

  it('shows active provider model management inside the third-party API settings panel', async () => {
    await renderApiConfigSection({
      settings: {
        ...settingsFixture,
        ...withOpenaiProvider({
          modelId: 'gpt-5.5',
          models: [
            { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
            { id: 'gpt-4.1', name: 'GPT-4.1' },
          ],
        }),
      },
    });

    expect(renderer.container.textContent).toContain('Provider');
    expect(renderer.container.querySelector('#third-party-base-url-input')).not.toBeNull();
    // Per-provider collapsible UI (no separate <select>): the active provider
    // (openai) is expanded by default and its model list editor is rendered.
    expect(renderer.container.querySelector('[aria-label="Model Name 1"]')).not.toBeNull();
  });

  it('explains that Live uses the browser API key directly without token endpoint settings', async () => {
    await renderApiConfigSection({
      apiKey: 'browser-key',
    });

    expect(renderer.container.textContent).toContain('Live connects from this browser');
    expect(renderer.container.textContent).toContain('uses your browser API key directly');
    expect(renderer.container.textContent).not.toContain('/api/live-token');
    expect(renderer.container.textContent).not.toContain('Advanced Live Settings');
    expect(renderer.container.querySelector('#live-token-endpoint-input')).toBeNull();
  });

  it('shows Vertex deployment state as read-only and hides browser Gemini key controls', async () => {
    window.__AMC_RUNTIME_CONFIG__ = {
      backendFlavor: 'vertex',
      serverManagedApi: true,
      useCustomApiConfig: true,
      useApiProxy: true,
      apiProxyUrl: '/api/gemini',
    };

    await renderApiConfigSection({
      useCustomApiConfig: true,
      useApiProxy: true,
      apiProxyUrl: '/api/gemini',
      serverManagedApi: true,
    });

    expect(renderer.container.textContent).toContain('Current Configuration');
    expect(renderer.container.textContent).toContain('Gemini Backend');
    expect(renderer.container.textContent).toContain('Vertex AI');
    expect(renderer.container.textContent).toContain('Server Service Account');
    expect(renderer.container.textContent).toContain('Managed by the server and shown here as read-only.');
    expect(renderer.container.textContent).not.toContain('Gemini API Keys');
    expect(renderer.container.textContent).not.toContain('Use Custom API Settings');
    expect(renderer.container.textContent).not.toContain('Live connects from this browser');

    const proxyInput = renderer.container.querySelector<HTMLInputElement>('#api-proxy-url-input');
    expect(proxyInput).not.toBeNull();
    expect(proxyInput?.readOnly).toBe(true);
    expect(proxyInput?.value).toBe('/api/gemini');
    expect(renderer.container.querySelector('#use-api-proxy-toggle')).toBeNull();
  });

  it('hides Gemini API key controls for server-managed AI Studio deployments', async () => {
    window.__AMC_RUNTIME_CONFIG__ = {
      backendFlavor: 'aistudio',
    };

    await renderApiConfigSection({
      useCustomApiConfig: true,
      useApiProxy: true,
      apiProxyUrl: '/api/gemini',
      serverManagedApi: true,
    });

    expect(renderer.container.textContent).toContain('Google AI Studio');
    expect(renderer.container.textContent).toContain('Server API Key');
    expect(renderer.container.textContent).not.toContain('Gemini API Keys');
    expect(renderer.container.textContent).not.toContain('Use Custom API Settings');
    expect(renderer.container.querySelector<HTMLInputElement>('#api-proxy-url-input')?.readOnly).toBe(true);
  });

  it('keeps third-party configuration editable and identifies it as browser-key auth', async () => {
    await renderApiConfigSection({
      settings: {
        ...settingsFixture,
        ...withOpenaiProvider({ baseUrl: 'https://openai-compatible.example/v1', apiKey: 'openai-key' }),
      },
    });

    expect(renderer.container.textContent).toContain('Current Configuration');
    expect(renderer.container.textContent).toContain('Third-Party API');
    expect(renderer.container.textContent).toContain('Not used in this API format');
    expect(renderer.container.textContent).toContain('Browser API Key');
    expect(renderer.container.textContent).toContain('https://openai-compatible.example/v1');
    expect(renderer.container.textContent).toContain('Base URL and API keys are configured in this browser.');
    expect(renderer.container.querySelector<HTMLTextAreaElement>('#api-key-input')?.readOnly).toBe(false);
    expect(renderer.container.querySelector<HTMLInputElement>('#third-party-base-url-input')?.readOnly).toBe(false);
  });
});
