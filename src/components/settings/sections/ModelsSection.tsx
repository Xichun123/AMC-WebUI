import React, { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { ChevronDown, Shield } from 'lucide-react';
import { type ApiMode, type AppSettings, type ModelOption } from '@/types';
import { ModelSelector } from '@/components/settings/controls/ModelSelector';
import { fetchOpenAICompatibleModels } from '@/services/api/openaiCompatibleApi';
import { fetchAnthropicModels } from '@/services/api/anthropicApi';
import { parseApiKeys } from '@/utils/apiKeySelection';
import { getThirdPartyProviderConfig } from '@/utils/thirdPartyApiProviders';
import { LiveArtifactsSection } from './LiveArtifactsSection';
import { GenerationSection } from './GenerationSection';
import { LanguageVoiceSection } from './LanguageVoiceSection';
import { SafetySection } from './SafetySection';
import type { SettingsUpdateHandler } from '@/components/settings/settingsTypes';
import { OpenAICompatibleModelListEditor } from './api-config/OpenAICompatibleModelListEditor';

interface ModelsSectionProps {
  modelId: string;
  setModelId: (id: string, apiMode?: ApiMode) => void;
  availableModels: ModelOption[];
  setAvailableModels: (models: ModelOption[]) => void;
  defaultModels?: ModelOption[];
  defaultApiMode?: ApiMode;
  isOpenAICompatibleMode?: boolean;
  currentSettings: AppSettings;
  currentThemeId: string;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

export const ModelsSection: React.FC<ModelsSectionProps> = ({
  modelId,
  setModelId,
  availableModels,
  setAvailableModels,
  defaultModels,
  defaultApiMode,
  isOpenAICompatibleMode = false,
  currentSettings,
  currentThemeId,
  onUpdateSettings,
}) => {
  const { t } = useI18n();
  const [isSafetyExpanded, setIsSafetyExpanded] = useState(false);
  const [modelFetchStatus, setModelFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [modelFetchMessage, setModelFetchMessage] = useState<string | null>(null);
  const viteEnv = (import.meta as ImportMeta & { env?: { VITE_OPENAI_API_KEY?: string } }).env;
  const hasOpenAIEnvKey = !!viteEnv?.VITE_OPENAI_API_KEY;
  const isThirdPartyApiEnabled = currentSettings.isThirdPartyApiEnabled === true;
  const activeProvider = getThirdPartyProviderConfig(currentSettings);

  const updateSetting: SettingsUpdateHandler = (key, value) => {
    onUpdateSettings({ [key]: value } as Partial<AppSettings>);
  };
  const geminiOnlyModels = availableModels
    .filter((model) => !model.apiMode || model.apiMode === 'gemini-native')
    .map((model) => {
      const nextModel = { ...model };
      delete nextModel.apiMode;
      return nextModel;
    });

  const resetOpenAICompatibleModelFetch = () => {
    setModelFetchStatus('idle');
    setModelFetchMessage(null);
  };

  const resolveProviderKey = (): string | null => activeProvider.apiKey || viteEnv?.VITE_OPENAI_API_KEY || null;

  const updateActiveProviderField = (partial: Partial<typeof activeProvider>) => {
    onUpdateSettings({
      thirdPartyApi: {
        ...currentSettings.thirdPartyApi,
        providers: {
          ...currentSettings.thirdPartyApi.providers,
          [currentSettings.thirdPartyApi.activeProvider]: { ...activeProvider, ...partial },
        },
      },
    });
  };

  const handleFetchOpenAICompatibleModels = async (): Promise<ModelOption[]> => {
    const keyToFetch = resolveProviderKey();

    if (!keyToFetch) {
      setModelFetchStatus('error');
      setModelFetchMessage(t('apiConfigNoKeyAvailable'));
      return [];
    }

    const keys = parseApiKeys(keyToFetch);
    const firstKey = keys[0];

    if (!firstKey) {
      setModelFetchStatus('error');
      setModelFetchMessage(t('apiConfigInvalidKeyFormat'));
      return [];
    }

    setModelFetchStatus('loading');
    setModelFetchMessage(null);

    try {
      const fetchedModels =
        activeProvider.protocol === 'anthropic'
          ? await fetchAnthropicModels(firstKey, activeProvider.baseUrl, new AbortController().signal)
          : await fetchOpenAICompatibleModels(firstKey, activeProvider.baseUrl, new AbortController().signal);

      if (fetchedModels.length === 0) {
        setModelFetchStatus('error');
        setModelFetchMessage(t('settingsOpenAICompatibleModelFetchEmpty'));
        return [];
      }

      setModelFetchStatus('success');
      setModelFetchMessage(
        t('settingsOpenAICompatibleModelFetchSuccess').replace('{count}', String(fetchedModels.length)),
      );
      return fetchedModels;
    } catch (error) {
      setModelFetchStatus('error');
      setModelFetchMessage(error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  const openaiCompatibleModelListEditor = isThirdPartyApiEnabled ? (
    <OpenAICompatibleModelListEditor
      models={activeProvider.models}
      selectedModelId={activeProvider.modelId}
      onModelsChange={(models) => {
        updateActiveProviderField({ models });
        resetOpenAICompatibleModelFetch();
      }}
      onSelectedModelChange={(modelId) => {
        updateActiveProviderField({ modelId });
        resetOpenAICompatibleModelFetch();
      }}
      onFetchModelsForImportPreview={handleFetchOpenAICompatibleModels}
      isFetchingModels={modelFetchStatus === 'loading'}
      isFetchModelsDisabled={modelFetchStatus === 'loading' || (!activeProvider.apiKey && !hasOpenAIEnvKey)}
      fetchModelsStatus={modelFetchStatus === 'loading' ? 'idle' : modelFetchStatus}
      fetchModelsMessage={modelFetchMessage}
    />
  ) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <ModelSelector
        availableModels={availableModels}
        selectedModelId={modelId}
        selectedApiMode={isOpenAICompatibleMode ? 'gemini-native' : currentSettings.apiMode}
        onSelectModel={setModelId}
        setAvailableModels={setAvailableModels}
        defaultModels={defaultModels}
        defaultApiMode={defaultApiMode}
        extraModelListContent={openaiCompatibleModelListEditor}
      />

      <GenerationSection
        isOpenAICompatibleMode={isOpenAICompatibleMode}
        modelId={modelId}
        currentSettings={currentSettings}
        onUpdateSetting={updateSetting}
      />

      {!isOpenAICompatibleMode && (
        <>
          <LiveArtifactsSection
            currentSettings={currentSettings}
            currentThemeId={currentThemeId}
            onUpdateSetting={updateSetting}
          />

          <LanguageVoiceSection
            availableModels={geminiOnlyModels}
            currentSettings={currentSettings}
            onUpdateSetting={updateSetting}
          />

          <div className="rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)]/30 p-4">
            <button
              type="button"
              onClick={() => setIsSafetyExpanded((prev) => !prev)}
              aria-expanded={isSafetyExpanded}
              aria-label={t('modelsSafetyToggleAria')}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex min-w-0 items-start gap-3">
                <Shield size={20} className="mt-0.5 flex-shrink-0 text-[var(--theme-text-link)]" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--theme-text-primary)]">
                    {t('safetyTitle')}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--theme-text-tertiary)]">
                    {t('safetyDescription')}
                  </span>
                </span>
              </span>
              <ChevronDown
                size={16}
                className={`flex-shrink-0 text-[var(--theme-text-tertiary)] transition-transform duration-200 ${
                  isSafetyExpanded ? 'rotate-180' : ''
                }`}
                strokeWidth={1.75}
              />
            </button>

            {isSafetyExpanded && (
              <div className="mt-4 border-t border-[var(--theme-border-secondary)]/60 pt-4">
                <SafetySection
                  safetySettings={currentSettings.safetySettings}
                  setSafetySettings={(safetySettings) => onUpdateSettings({ safetySettings })}
                  showIntro={false}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
