import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, Circle } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/formClasses';
import type { AppSettings, ThirdPartyApiSettings, ThirdPartyProviderId } from '@/types';
import {
  THIRD_PARTY_PROVIDER_IDS,
  THIRD_PARTY_PROVIDER_LABELS,
  getThirdPartyProviderConfig,
  updateThirdPartyProviderConfig,
} from '@/utils/thirdPartyApiProviders';
import { ApiKeyInput } from './ApiKeyInput';
import { ApiConnectionTester } from './ApiConnectionTester';
import { OpenAICompatibleModelListEditor } from './OpenAICompatibleModelListEditor';

interface ThirdPartyApiSettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onResetConnectionTest: () => void;
  onTestConnection: () => void;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testMessage: string | null;
  hasEnvKey: boolean;
}

export const ThirdPartyApiSettingsPanel: React.FC<ThirdPartyApiSettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onResetConnectionTest,
  onTestConnection,
  testStatus,
  testMessage,
}) => {
  const { t } = useI18n();
  const [expandedProvider, setExpandedProvider] = useState<ThirdPartyProviderId | null>(
    settings.thirdPartyApi?.activeProvider ?? null,
  );

  const thirdPartyApi = settings.thirdPartyApi;
  const activeConfig = getThirdPartyProviderConfig(settings);
  const expandedId = expandedProvider ?? settings.thirdPartyApi?.activeProvider ?? 'openai';
  const expandedConfig = thirdPartyApi?.providers?.[expandedId] ?? activeConfig;

  const updateThirdPartyApi = (next: ThirdPartyApiSettings) => {
    onUpdateSettings({ thirdPartyApi: next });
  };

  const handleToggleEnabled = (providerId: ThirdPartyProviderId) => {
    const provider = thirdPartyApi?.providers?.[providerId];
    const nextEnabled = !provider?.enabled;
    updateThirdPartyApi(updateThirdPartyProviderConfig(thirdPartyApi, providerId, { enabled: nextEnabled }));
  };

  const updateField = <K extends keyof typeof expandedConfig>(key: K, value: (typeof expandedConfig)[K]) => {
    updateThirdPartyApi(updateThirdPartyProviderConfig(thirdPartyApi, expandedId, { [key]: value }));
    onResetConnectionTest();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {THIRD_PARTY_PROVIDER_IDS.map((providerId) => {
          const config = thirdPartyApi?.providers?.[providerId];
          const isEnabled = config?.enabled === true;
          const hasKey = !!config?.apiKey;
          const isExpanded = expandedId === providerId;

          return (
            <div
              key={providerId}
              className={`rounded-lg border transition-all ${
                isEnabled
                  ? 'border-[var(--theme-border-focus)] bg-[var(--theme-bg-tertiary)]/30'
                  : 'border-[var(--theme-border-secondary)]/40 bg-[var(--theme-bg-tertiary)]/10'
              }`}
            >
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(providerId)}
                  className="flex-shrink-0 cursor-pointer transition-colors"
                  title={isEnabled ? t('disable') : t('enable')}
                >
                  {isEnabled ? (
                    <CircleCheck size={18} className="text-[var(--theme-text-link)]" strokeWidth={2} />
                  ) : (
                    <Circle size={18} className="text-[var(--theme-text-tertiary)]" strokeWidth={2} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextExpanded = isExpanded ? null : providerId;
                    setExpandedProvider(nextExpanded);
                    // Sync activeProvider so test-connection targets this provider.
                    if (nextExpanded) {
                      updateThirdPartyApi({ ...thirdPartyApi, activeProvider: nextExpanded });
                    }
                  }}
                  className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-[var(--theme-text-tertiary)]" strokeWidth={2} />
                  ) : (
                    <ChevronRight size={14} className="text-[var(--theme-text-tertiary)]" strokeWidth={2} />
                  )}
                  <span className="text-sm font-medium text-[var(--theme-text-primary)] truncate">
                    {THIRD_PARTY_PROVIDER_LABELS[providerId]}
                  </span>
                  {isEnabled && !hasKey && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-status-warning-bg)] text-[var(--theme-status-warning-text)]">
                      {t('thirdPartyApiKeyMissing')}
                    </span>
                  )}
                  {isEnabled && hasKey && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--theme-status-success-bg)] text-[var(--theme-status-success-text)]">
                      {t('thirdPartyApiReady')}
                    </span>
                  )}
                </button>
              </div>

              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-3 border-t border-[var(--theme-border-secondary)]/30 pt-3">
                  <ApiKeyInput
                    apiKey={expandedConfig.apiKey}
                    setApiKey={(value) => updateField('apiKey', value)}
                    label={t('thirdPartyApiKey')}
                    placeholder={t('apiConfigOpenaiKeyPlaceholder')}
                    helpText={t('thirdPartyApiKeyHelp')}
                  />

                  <div className="space-y-2">
                    <label
                      htmlFor="third-party-base-url-input"
                      className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]"
                    >
                      {t('thirdPartyApiBaseUrl')}
                    </label>
                    <input
                      id="third-party-base-url-input"
                      type="text"
                      value={expandedConfig.baseUrl || ''}
                      onChange={(e) => updateField('baseUrl', e.target.value)}
                      className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm custom-scrollbar font-mono ${SETTINGS_INPUT_CLASS}`}
                      aria-label={t('thirdPartyApiBaseUrl')}
                    />
                  </div>

                  <OpenAICompatibleModelListEditor
                    models={expandedConfig.models}
                    selectedModelId={expandedConfig.modelId}
                    onModelsChange={(models) => updateField('models', models)}
                    onSelectedModelChange={(modelId) => updateField('modelId', modelId)}
                  />

                  <ApiConnectionTester
                    onTest={onTestConnection}
                    testStatus={testStatus}
                    testMessage={testMessage}
                    isTestDisabled={testStatus === 'testing' || !expandedConfig.apiKey}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
