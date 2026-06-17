import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@/constants/settingsDefaults';
import { type ChatSettings } from '@/types';
import {
  formatApiKeyErrorMessage,
  getGeminiKeyForRequest,
  getKeyForRequest,
  isServerManagedApiEnabledForProxyRequests,
  SERVER_MANAGED_API_KEY,
} from './apiKeySelection';
import { logService } from '@/services/logService';

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createLogServiceMockModule();
});

describe('getKeyForRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const chatSettings: ChatSettings = {
    modelId: 'gemini-2.5-flash-preview-09-2025',
    temperature: 1,
    topP: 0.95,
    topK: 64,
    showThoughts: false,
    systemInstruction: '',
    ttsVoice: 'Puck',
    thinkingBudget: 0,
  };

  it('returns server-managed marker key when using proxy custom config with no browser key', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
        apiKey: null,
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: SERVER_MANAGED_API_KEY,
      isNewKey: false,
    });
  });

  it('keeps legacy API key missing error when server-managed flow is not enabled', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: false,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
        apiKey: null,
      },
      chatSettings,
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });

  it('uses real configured API key when server-managed mode is enabled but key exists', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
        apiKey: 'real-browser-key',
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: 'real-browser-key',
      isNewKey: true,
    });
  });

  it('uses the dedicated OpenAI-compatible key without mutating Gemini API keys', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isOpenAICompatibleApiEnabled: true,
        apiMode: 'openai-compatible',
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        openaiCompatibleApiKey: 'openai-key',
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: 'openai-key',
      isNewKey: true,
    });
  });

  it('reports a missing key for OpenAI-compatible mode when only Gemini keys exist', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isOpenAICompatibleApiEnabled: true,
        apiMode: 'openai-compatible',
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        openaiCompatibleApiKey: null,
      },
      chatSettings,
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });

  it('uses Gemini key handling when OpenAI-compatible mode is stored but the provider switch is off', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isOpenAICompatibleApiEnabled: false,
        apiMode: 'openai-compatible',
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        openaiCompatibleApiKey: 'openai-key',
      },
      chatSettings,
    );

    expect(result).toEqual({
      key: 'gemini-key',
      isNewKey: true,
    });
  });

  it('can select a key without recording usage for Live token setup', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        useCustomApiConfig: true,
        apiKey: 'real-browser-key',
      },
      chatSettings,
      { skipIncrement: true, skipUsageLogging: true },
    );

    expect(result).toEqual({
      key: 'real-browser-key',
      isNewKey: true,
    });
    expect(logService.recordApiKeyUsage).not.toHaveBeenCalled();
  });

  it('can force Gemini key handling while OpenAI-compatible mode is active', () => {
    const result = getGeminiKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isOpenAICompatibleApiEnabled: true,
        apiMode: 'openai-compatible',
        useCustomApiConfig: true,
        apiKey: 'gemini-key',
        openaiCompatibleApiKey: 'openai-key',
      },
      {
        ...chatSettings,
        lockedApiKey: 'openai-key',
      },
      { skipIncrement: true },
    );

    expect(result).toEqual({
      key: 'gemini-key',
      isNewKey: true,
    });
  });

  it('does not fall back to the OpenAI-compatible key when forcing Gemini key handling', () => {
    const result = getGeminiKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isOpenAICompatibleApiEnabled: true,
        apiMode: 'openai-compatible',
        useCustomApiConfig: true,
        apiKey: null,
        openaiCompatibleApiKey: 'openai-key',
      },
      chatSettings,
      { skipIncrement: true },
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });

  it('resolves the active third-party provider api key when third-party mode is active', () => {
    const anthropicProvider = {
      apiKey: 'sk-ant-test',
      baseUrl: 'https://api.anthropic.com',
      modelId: 'claude-sonnet-4-6',
      models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', isPinned: true }],
      protocol: 'anthropic' as const,
    };
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isThirdPartyApiEnabled: true,
        apiMode: 'third-party',
        thirdPartyApi: {
          activeProvider: 'anthropic',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            anthropic: anthropicProvider,
          },
        },
      },
      chatSettings,
    );

    expect('key' in result).toBe(true);
    expect((result as { key: string }).key).toBe('sk-ant-test');
  });

  it('returns error when third-party provider has no api key', () => {
    const result = getKeyForRequest(
      {
        ...DEFAULT_APP_SETTINGS,
        isThirdPartyApiEnabled: true,
        apiMode: 'third-party',
        thirdPartyApi: {
          activeProvider: 'anthropic',
          providers: {
            ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers,
            anthropic: { ...DEFAULT_APP_SETTINGS.thirdPartyApi.providers.anthropic, apiKey: null },
          },
        },
      },
      chatSettings,
    );

    expect(result).toEqual({ error: 'API Key not configured.' });
  });
});

describe('isServerManagedApiEnabledForProxyRequests', () => {
  it('returns true only when all required server-managed proxy conditions are met', () => {
    expect(
      isServerManagedApiEnabledForProxyRequests({
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: 'https://proxy.example.com/v1beta',
      }),
    ).toBe(true);

    expect(
      isServerManagedApiEnabledForProxyRequests({
        ...DEFAULT_APP_SETTINGS,
        serverManagedApi: true,
        useCustomApiConfig: true,
        useApiProxy: true,
        apiProxyUrl: '   ',
      }),
    ).toBe(false);
  });
});

describe('formatApiKeyErrorMessage', () => {
  it('translates known API key errors and keeps unknown messages intact', () => {
    const translate = vi.fn((translationKey: string) => `translated:${translationKey}`);

    expect(formatApiKeyErrorMessage('API Key not configured.', translate)).toBe(
      'translated:apiRuntimeKeyNotConfigured',
    );
    expect(formatApiKeyErrorMessage('custom failure', translate)).toBe('custom failure');
  });
});
