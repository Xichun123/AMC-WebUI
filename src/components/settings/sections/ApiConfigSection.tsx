import React, { useState, useEffect, useRef } from 'react';
import { RadioTower } from 'lucide-react';
import type { AppSettings } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { DEFAULT_LIVE_ARTIFACTS_MODEL_ID } from '@/constants/modelConfiguration';
import { CONNECTION_TEST_MODELS } from '@/constants/settingsModelOptions';
import { getClient } from '@/services/api/apiClient';
import { sendOpenAICompatibleMessageNonStream } from '@/services/api/openaiCompatibleApi';
import { sendAnthropicMessageNonStream } from '@/services/api/anthropicApi';
import {
  isServerManagedApiEnabledForProxyRequests,
  parseApiKeys,
  SERVER_MANAGED_API_KEY,
} from '@/utils/apiKeySelection';
import { getBackendFlavor } from '@/runtime/runtimeConfig';
import { getThirdPartyProviderConfig } from '@/utils/thirdPartyApiProviders';
import { ApiConfigToggle } from './api-config/ApiConfigToggle';
import { ApiKeyInput } from './api-config/ApiKeyInput';
import { ApiProxySettings } from './api-config/ApiProxySettings';
import { ApiConnectionTester } from './api-config/ApiConnectionTester';
import { ThirdPartyApiSettingsPanel } from './api-config/ThirdPartyApiSettingsPanel';
import { FileStrategyControl } from './appearance/FileStrategyControl';
import { isThirdPartyApiActive } from '@/utils/thirdPartyApiActive';

interface ApiConfigSectionProps {
  useCustomApiConfig: boolean;
  setUseCustomApiConfig: (value: boolean) => void;
  apiKey: string | null;
  setApiKey: (value: string | null) => void;
  apiProxyUrl: string | null;
  setApiProxyUrl: (value: string | null) => void;
  useApiProxy: boolean;
  setUseApiProxy: (value: boolean) => void;
  serverManagedApi: boolean;
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const ApiConfigSection: React.FC<ApiConfigSectionProps> = ({
  useCustomApiConfig,
  setUseCustomApiConfig,
  apiKey,
  setApiKey,
  apiProxyUrl,
  setApiProxyUrl,
  useApiProxy,
  setUseApiProxy,
  serverManagedApi,
  settings,
  onUpdate,
}) => {
  const { t } = useI18n();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testModelId, setTestModelId] = useState<string>(DEFAULT_LIVE_ARTIFACTS_MODEL_ID);
  const [allowOverflow, setAllowOverflow] = useState(useCustomApiConfig);
  const overflowTimerRef = useRef<number | null>(null);
  const viteEnv = (import.meta as ImportMeta & { env?: { VITE_GEMINI_API_KEY?: string; VITE_OPENAI_API_KEY?: string } })
    .env;

  const hasEnvKey = !!viteEnv?.VITE_GEMINI_API_KEY;
  const hasOpenAIEnvKey = !!viteEnv?.VITE_OPENAI_API_KEY;
  const canUseServerManagedTestKey = isServerManagedApiEnabledForProxyRequests({
    serverManagedApi,
    useCustomApiConfig,
    useApiProxy,
    apiProxyUrl,
  });
  const isOpenAICompatibleMode = isThirdPartyApiActive(settings);
  const activeProvider = getThirdPartyProviderConfig(settings);
  const backendFlavor = getBackendFlavor();
  const isVertexBackend = backendFlavor === 'vertex';
  const isGeminiServerManaged = !isOpenAICompatibleMode && (isVertexBackend || canUseServerManagedTestKey);
  const effectiveGeminiProxyUrl = apiProxyUrl?.trim() || (isGeminiServerManaged ? '/api/gemini' : null);
  const canUseServerManagedGeminiTestKey = isGeminiServerManaged && !!effectiveGeminiProxyUrl;
  const shouldShowGeminiApiKeyInput = !isGeminiServerManaged;
  const shouldShowGeminiCustomApiToggle = !isGeminiServerManaged;
  const shouldShowGeminiConfigDetails = useCustomApiConfig || isGeminiServerManaged;
  const apiStatusItems = isOpenAICompatibleMode
    ? [
        { label: t('settingsApiStatusFormat'), value: t('settingsApiModeOpenAICompatible') },
        { label: t('settingsApiStatusGeminiBackend'), value: t('settingsApiStatusNoGeminiBackend') },
        { label: t('settingsApiStatusAuthentication'), value: t('settingsApiStatusBrowserApiKey') },
        {
          label: t('settingsApiStatusOpenAIEndpoint'),
          value: activeProvider.baseUrl?.trim() || '',
          code: true,
        },
      ]
    : [
        { label: t('settingsApiStatusFormat'), value: t('settingsApiModeGeminiNative') },
        {
          label: t('settingsApiStatusGeminiBackend'),
          value: isVertexBackend ? t('settingsApiStatusVertexBackend') : t('settingsApiStatusAiStudioBackend'),
        },
        {
          label: t('settingsApiStatusAuthentication'),
          value: isVertexBackend
            ? t('settingsApiStatusServerServiceAccount')
            : isGeminiServerManaged
              ? t('settingsApiStatusServerApiKey')
              : t('settingsApiStatusBrowserApiKey'),
        },
        {
          label: t('settingsApiStatusEndpoint'),
          value:
            useApiProxy || isGeminiServerManaged
              ? effectiveGeminiProxyUrl || '/api/gemini'
              : 'https://generativelanguage.googleapis.com',
          code: true,
        },
      ];
  const apiStatusHelp = isOpenAICompatibleMode
    ? t('settingsApiStatusOpenAIEditable')
    : isGeminiServerManaged
      ? t('settingsApiStatusManagedReadOnly')
      : null;

  useEffect(() => {
    return () => {
      if (overflowTimerRef.current !== null) {
        window.clearTimeout(overflowTimerRef.current);
      }
    };
  }, []);

  const handleUseCustomApiConfigChange = (value: boolean) => {
    if (overflowTimerRef.current !== null) {
      window.clearTimeout(overflowTimerRef.current);
      overflowTimerRef.current = null;
    }

    setUseCustomApiConfig(value);

    if (value) {
      setAllowOverflow(false);
      overflowTimerRef.current = window.setTimeout(() => {
        setAllowOverflow(true);
        overflowTimerRef.current = null;
      }, 300);
      return;
    }

    setAllowOverflow(false);
  };

  const handleApiProviderChange = (nextApiMode: AppSettings['apiMode']) => {
    const isThirdParty = nextApiMode === 'third-party';
    onUpdate('apiMode', isThirdParty ? 'third-party' : 'gemini-native');
    onUpdate('isThirdPartyApiEnabled', isThirdParty);
    setTestStatus('idle');
    setTestMessage(null);
  };

  const resetConnectionTest = () => {
    setTestStatus('idle');
    setTestMessage(null);
  };

  const resolveProviderKey = (): string | null => activeProvider.apiKey || viteEnv?.VITE_OPENAI_API_KEY || null;

  const handleTestConnection = async () => {
    const resolveKeyToTest = (): string | null => {
      if (isOpenAICompatibleMode) {
        return resolveProviderKey();
      }
      if (canUseServerManagedGeminiTestKey) return SERVER_MANAGED_API_KEY;
      if (apiKey) return apiKey;
      if (!useCustomApiConfig && hasEnvKey) {
        return viteEnv?.VITE_GEMINI_API_KEY || null;
      }
      return null;
    };

    const keyToTest = resolveKeyToTest();

    if (!isOpenAICompatibleMode && !keyToTest && useCustomApiConfig && !canUseServerManagedGeminiTestKey) {
      setTestStatus('error');
      setTestMessage(t('apiConfigNoKeyProvided'));
      return;
    }

    if (!keyToTest) {
      setTestStatus('error');
      setTestMessage(t('apiConfigNoKeyAvailable'));
      return;
    }

    const keys = parseApiKeys(keyToTest);
    const firstKey = keys[0];

    if (!firstKey) {
      setTestStatus('error');
      setTestMessage(t('apiConfigInvalidKeyFormat'));
      return;
    }

    const effectiveUrl = isGeminiServerManaged
      ? effectiveGeminiProxyUrl
      : useCustomApiConfig && useApiProxy && apiProxyUrl
        ? apiProxyUrl
        : null;

    setTestStatus('testing');
    setTestMessage(null);

    try {
      const modelIdToUse = isOpenAICompatibleMode
        ? activeProvider.modelId
        : testModelId || DEFAULT_LIVE_ARTIFACTS_MODEL_ID;

      if (isOpenAICompatibleMode) {
        let providerError: Error | null = null;
        const onError = (error: Error) => {
          providerError = error;
        };
        const providerConfig = {
          baseUrl: activeProvider.baseUrl,
          temperature: 0,
        };

        if (activeProvider.protocol === 'anthropic') {
          await sendAnthropicMessageNonStream(
            firstKey,
            modelIdToUse,
            [],
            [{ text: 'Hello' }],
            providerConfig,
            new AbortController().signal,
            onError,
            () => undefined,
          );
        } else {
          await sendOpenAICompatibleMessageNonStream(
            firstKey,
            modelIdToUse,
            [],
            [{ text: 'Hello' }],
            providerConfig,
            new AbortController().signal,
            onError,
            () => undefined,
          );
        }

        if (providerError) {
          throw providerError;
        }
      } else {
        const ai = await getClient(firstKey, effectiveUrl);

        await ai.models.generateContent({
          model: modelIdToUse,
          contents: 'Hello',
        });
      }

      setTestStatus('success');
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const modeButtonClass = (isActive: boolean) =>
    `relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg-secondary)] ${
      isActive
        ? 'bg-[var(--theme-bg-input)] text-[var(--theme-text-primary)] shadow-sm ring-1 ring-black/5 dark:ring-white/10'
        : 'text-[var(--theme-text-tertiary)] hover:bg-[var(--theme-bg-tertiary)]/60 hover:text-[var(--theme-text-primary)]'
    }`;

  const renderApiStatus = () => (
    <div className="rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)]/20 p-3">
      <div className="mb-3 text-xs font-semibold uppercase text-[var(--theme-text-tertiary)]">
        {t('settingsApiStatusTitle')}
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {apiStatusItems.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[11px] font-medium text-[var(--theme-text-tertiary)]">{item.label}</dt>
            <dd
              className={`mt-0.5 break-words text-sm font-medium text-[var(--theme-text-primary)] ${
                item.code ? 'font-mono text-[13px]' : ''
              }`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {apiStatusHelp && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--theme-text-tertiary)]">{apiStatusHelp}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="space-y-3 pb-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
              {t('settingsApiModeLabel')}
            </div>
            <div
              role="group"
              aria-label={t('settingsApiModeLabel')}
              className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)]/35 p-1 shadow-sm"
            >
              <button
                type="button"
                className={modeButtonClass(!isOpenAICompatibleMode)}
                aria-pressed={!isOpenAICompatibleMode}
                onClick={() => handleApiProviderChange('gemini-native')}
              >
                {t('settingsApiModeGeminiNative')}
              </button>
              <button
                type="button"
                className={modeButtonClass(isOpenAICompatibleMode)}
                aria-pressed={isOpenAICompatibleMode}
                onClick={() => handleApiProviderChange('third-party')}
              >
                {t('settingsApiModeOpenAICompatible')}
              </button>
            </div>
          </div>
          {renderApiStatus()}
          {isOpenAICompatibleMode && (
            <ThirdPartyApiSettingsPanel
              settings={settings}
              onUpdateSettings={(partial) => {
                (Object.entries(partial) as Array<[keyof AppSettings, AppSettings[keyof AppSettings]]>).forEach(
                  ([key, value]) => {
                    onUpdate(key, value);
                  },
                );
              }}
              onResetConnectionTest={resetConnectionTest}
              onTestConnection={handleTestConnection}
              testStatus={testStatus}
              testMessage={testMessage}
              hasEnvKey={hasOpenAIEnvKey}
            />
          )}
        </div>

        {!isOpenAICompatibleMode && (
          <>
            {shouldShowGeminiCustomApiToggle && (
              <ApiConfigToggle
                useCustomApiConfig={useCustomApiConfig}
                setUseCustomApiConfig={handleUseCustomApiConfigChange}
                hasEnvKey={hasEnvKey}
              />
            )}

            <div
              className={`transition-all duration-300 ease-in-out ${shouldShowGeminiConfigDetails ? 'opacity-100 max-h-[1000px] pt-4' : 'opacity-50 max-h-0'} ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'}`}
            >
              <div className="space-y-5">
                {shouldShowGeminiApiKeyInput && (
                  <ApiKeyInput
                    apiKey={apiKey}
                    setApiKey={(nextApiKey) => {
                      setApiKey(nextApiKey);
                      setTestStatus('idle');
                    }}
                  />
                )}

                <ApiProxySettings
                  useApiProxy={isGeminiServerManaged ? true : useApiProxy}
                  setUseApiProxy={(nextUseApiProxy) => {
                    setUseApiProxy(nextUseApiProxy);
                    setTestStatus('idle');
                  }}
                  apiProxyUrl={isGeminiServerManaged ? effectiveGeminiProxyUrl : apiProxyUrl}
                  setApiProxyUrl={(nextApiProxyUrl) => {
                    setApiProxyUrl(nextApiProxyUrl);
                    setTestStatus('idle');
                  }}
                  readOnly={isGeminiServerManaged}
                />

                {shouldShowGeminiApiKeyInput && (
                  <div className="space-y-3 pt-2">
                    <div className="rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)]/20 p-3">
                      <div className="flex items-start gap-3">
                        <RadioTower
                          size={16}
                          className="mt-0.5 flex-shrink-0 text-[var(--theme-text-link)]"
                          strokeWidth={1.5}
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-sm font-medium text-[var(--theme-text-primary)]">
                            {t('settingsLiveAutomaticTitle')}
                          </p>
                          <p className="text-xs leading-relaxed text-[var(--theme-text-tertiary)]">
                            {t('settingsLiveAutomaticHelp')}
                          </p>
                          {useApiProxy && (
                            <p className="text-xs leading-relaxed text-[var(--theme-text-tertiary)]">
                              {t('settingsLiveProxyCompatibilityHelp')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <ApiConnectionTester
                  onTest={handleTestConnection}
                  testStatus={testStatus}
                  testMessage={testMessage}
                  isTestDisabled={
                    testStatus === 'testing' || (!apiKey && useCustomApiConfig && !canUseServerManagedGeminiTestKey)
                  }
                  availableModels={CONNECTION_TEST_MODELS}
                  testModelId={testModelId}
                  onModelChange={setTestModelId}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!isOpenAICompatibleMode && <FileStrategyControl settings={settings} onUpdate={onUpdate} />}
    </div>
  );
};
