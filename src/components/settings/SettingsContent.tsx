import React from 'react';
import type { ApiMode, AppSettings, ModelOption } from '@/types';
import { type SettingsTab } from '@/stores/settingsUiStore';
import { getDefaultModelOptions } from '@/utils/defaultModelOptions';
import { ApiConfigSection } from './sections/ApiConfigSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { DataManagementSection } from './sections/DataManagementSection';
import { ModelsSection } from './sections/ModelsSection';
import { McpSection } from './sections/McpSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { AboutSection } from './sections/AboutSection';
import { type SettingsTransferProps } from './settingsTypes';
import type { LogViewerProps } from '@/components/log-viewer/LogViewer';
import { isThirdPartyApiActive } from '@/utils/thirdPartyApiActive';
import { getThirdPartyProviderConfig } from '@/utils/thirdPartyApiProviders';
interface SettingsContentProps extends SettingsTransferProps {
  activeTab: SettingsTab;
  currentSettings: AppSettings;
  currentThemeId: string;
  availableModels: ModelOption[];
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  handleModelChange: (modelId: string) => void;
  setAvailableModels: (models: ModelOption[]) => void;
  onClearHistory: () => void;
  onClearCache: () => void;
  onOpenLogViewer: (state?: Pick<LogViewerProps, 'initialTab' | 'initialUsageTab'>) => void;
  onClearLogs: () => void;
  onReset: () => void;
  onImportSettings: (file: File) => void;
  onExportSettings: () => void;
  onImportHistory: (file: File) => void;
  onExportHistory: () => void;
}

const stripApiMode = (model: ModelOption): ModelOption => {
  const nextModel = { ...model };
  delete nextModel.apiMode;
  return nextModel;
};

const tagModelsWithApiMode = (models: ModelOption[], apiMode: ApiMode): ModelOption[] =>
  models.map((model) => ({
    ...stripApiMode(model),
    apiMode,
  }));

const buildGeminiModelList = (geminiModels: ModelOption[]): ModelOption[] =>
  tagModelsWithApiMode(geminiModels, 'gemini-native');

const getGeminiModelsFromEditedList = (models: ModelOption[]): ModelOption[] =>
  models.filter((model) => model.apiMode !== 'third-party').map(stripApiMode);

const getFallbackModelId = (models: ModelOption[]): string | undefined =>
  models.find((model) => model.isPinned)?.id || models[0]?.id;

const hasModelId = (models: ModelOption[], modelId: string): boolean => models.some((model) => model.id === modelId);

export const SettingsContent: React.FC<SettingsContentProps> = ({
  activeTab,
  currentSettings,
  currentThemeId,
  availableModels,
  updateSetting,
  handleModelChange,
  setAvailableModels,
  onClearHistory,
  onClearCache,
  onOpenLogViewer,
  onClearLogs,
  onReset,
  onInstallPwa,
  installState,
  onImportSettings,
  onExportSettings,
  onImportHistory,
  onExportHistory,
  onImportScenarios,
  onExportScenarios,
}) => {
  const animClass = 'animate-in fade-in duration-200 ease-out';
  const isOpenAICompatibleMode = isThirdPartyApiActive(currentSettings);
  const effectiveModelId = currentSettings.modelId;
  const effectiveAvailableModels = React.useMemo(() => buildGeminiModelList(availableModels), [availableModels]);
  const effectiveDefaultModels = React.useMemo(() => buildGeminiModelList(getDefaultModelOptions()), []);
  const shortcutAvailableModels = React.useMemo(() => {
    if (currentSettings.isThirdPartyApiEnabled !== true) {
      return effectiveAvailableModels;
    }

    return [
      ...effectiveAvailableModels,
      ...tagModelsWithApiMode(getThirdPartyProviderConfig(currentSettings).models, 'third-party'),
    ];
  }, [currentSettings, effectiveAvailableModels]);

  const handleBatchUpdate = (updates: Partial<AppSettings>) => {
    (Object.entries(updates) as Array<[keyof AppSettings, AppSettings[keyof AppSettings]]>).forEach(([key, value]) => {
      updateSetting(key, value);
    });
  };

  const handleEffectiveModelChange = (modelId: string, apiMode?: ApiMode) => {
    if (apiMode === 'third-party') {
      return;
    }

    if (isOpenAICompatibleMode) {
      updateSetting('apiMode', 'gemini-native');
    }
    handleModelChange(modelId);
  };

  const handleAvailableModelsChange = (models: ModelOption[]) => {
    const geminiModels = getGeminiModelsFromEditedList(models);

    setAvailableModels(geminiModels);

    const geminiFallbackModelId = getFallbackModelId(geminiModels);

    if (geminiFallbackModelId && !hasModelId(geminiModels, currentSettings.modelId)) {
      handleModelChange(geminiFallbackModelId);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      {activeTab === 'models' && (
        <div className={`${animClass} max-w-4xl mx-auto`}>
          <ModelsSection
            modelId={effectiveModelId}
            setModelId={handleEffectiveModelChange}
            availableModels={effectiveAvailableModels}
            setAvailableModels={handleAvailableModelsChange}
            defaultModels={effectiveDefaultModels}
            defaultApiMode="gemini-native"
            isOpenAICompatibleMode={isOpenAICompatibleMode}
            currentSettings={currentSettings}
            currentThemeId={currentThemeId}
            onUpdateSettings={handleBatchUpdate}
          />
        </div>
      )}

      {activeTab === 'interface' && (
        <div className={animClass}>
          <AppearanceSection settings={currentSettings} onUpdate={updateSetting} />
        </div>
      )}

      {activeTab === 'api' && (
        <div className={animClass}>
          <ApiConfigSection
            useCustomApiConfig={currentSettings.useCustomApiConfig}
            setUseCustomApiConfig={(useCustomApiConfig) => updateSetting('useCustomApiConfig', useCustomApiConfig)}
            apiKey={currentSettings.apiKey}
            setApiKey={(apiKey) => updateSetting('apiKey', apiKey)}
            apiProxyUrl={currentSettings.apiProxyUrl}
            setApiProxyUrl={(apiProxyUrl) => updateSetting('apiProxyUrl', apiProxyUrl)}
            useApiProxy={currentSettings.useApiProxy ?? false}
            setUseApiProxy={(useApiProxy) => updateSetting('useApiProxy', useApiProxy)}
            serverManagedApi={currentSettings.serverManagedApi ?? false}
            settings={currentSettings}
            onUpdate={updateSetting}
          />
        </div>
      )}

      {activeTab === 'mcp' && (
        <div className={animClass}>
          <McpSection settings={currentSettings} onUpdate={updateSetting} />
        </div>
      )}

      {activeTab === 'data' && (
        <div className={animClass}>
          <DataManagementSection
            onClearHistory={onClearHistory}
            onClearCache={onClearCache}
            onOpenLogViewer={onOpenLogViewer}
            onClearLogs={onClearLogs}
            onInstallPwa={onInstallPwa}
            installState={installState}
            onImportSettings={onImportSettings}
            onExportSettings={onExportSettings}
            onImportHistory={onImportHistory}
            onExportHistory={onExportHistory}
            onImportScenarios={onImportScenarios}
            onExportScenarios={onExportScenarios}
            onReset={onReset}
          />
        </div>
      )}

      {activeTab === 'shortcuts' && (
        <div className={animClass}>
          <ShortcutsSection
            currentSettings={currentSettings}
            availableModels={shortcutAvailableModels}
            onUpdateSettings={handleBatchUpdate}
          />
        </div>
      )}

      {activeTab === 'about' && (
        <div className={animClass}>
          <AboutSection />
        </div>
      )}
    </div>
  );
};
