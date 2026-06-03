import React from 'react';
import type { AppSettings } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/formClasses';
import {
  buildOpenAICompatibleChatCompletionsUrl,
  getOpenAICompatibleBaseUrlWarning,
} from '@/services/api/openaiCompatibleUrls';
import { DEFAULT_OPENAI_COMPATIBLE_BASE_URL } from '@/utils/apiProxyUrl';
import { ApiConnectionTester } from './ApiConnectionTester';
import { ApiKeyInput } from './ApiKeyInput';

interface OpenAICompatibleApiSettingsPanelProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onResetConnectionTest: () => void;
  onTestConnection: () => void;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  testMessage: string | null;
  hasOpenAIEnvKey: boolean;
}

export const OpenAICompatibleApiSettingsPanel: React.FC<OpenAICompatibleApiSettingsPanelProps> = ({
  settings,
  onUpdate,
  onResetConnectionTest,
  onTestConnection,
  testStatus,
  testMessage,
  hasOpenAIEnvKey,
}) => {
  const { t } = useI18n();
  const openaiCompatibleApiKey = settings.openaiCompatibleApiKey;
  const requestPreview = buildOpenAICompatibleChatCompletionsUrl(settings.openaiCompatibleBaseUrl);
  const baseUrlWarning = getOpenAICompatibleBaseUrlWarning(settings.openaiCompatibleBaseUrl);
  const baseUrlWarningPath = baseUrlWarning === 'models-endpoint' ? '/models' : '/chat/completions';
  const baseUrlWarningMessage = baseUrlWarning
    ? t('settingsOpenAICompatibleBaseUrlEndpointWarning').replace('{path}', baseUrlWarningPath)
    : null;

  return (
    <div className="space-y-4">
      <ApiKeyInput
        apiKey={openaiCompatibleApiKey}
        setApiKey={(value) => {
          onUpdate('openaiCompatibleApiKey', value);
          onResetConnectionTest();
        }}
        label={t('settingsOpenAICompatibleApiKey')}
        placeholder={t('apiConfig_openai_key_placeholder')}
        helpText={t('settingsOpenAICompatibleApiKeyHelp')}
      />
      <div className="space-y-2">
        <label
          htmlFor="openai-compatible-base-url-input"
          className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]"
        >
          {t('settingsOpenAICompatibleBaseUrl')}
        </label>
        <input
          id="openai-compatible-base-url-input"
          type="text"
          value={settings.openaiCompatibleBaseUrl || ''}
          onChange={(event) => {
            onUpdate('openaiCompatibleBaseUrl', event.target.value);
            onResetConnectionTest();
          }}
          className={`w-full p-3 rounded-lg border transition-all duration-200 focus:ring-2 focus:ring-offset-0 text-sm custom-scrollbar font-mono ${SETTINGS_INPUT_CLASS}`}
          placeholder={DEFAULT_OPENAI_COMPATIBLE_BASE_URL}
          aria-label={t('settingsOpenAICompatibleBaseUrl')}
        />
        <p className="text-xs leading-relaxed text-[var(--theme-text-tertiary)]">{t('settingsOpenAICompatibleHelp')}</p>
        <div className="space-y-1 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)]/35 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
            {t('settingsOpenAICompatibleRequestUrlPreview')}
          </div>
          <div className="break-all font-mono text-xs text-[var(--theme-text-primary)]">{requestPreview}</div>
        </div>
        {baseUrlWarningMessage && (
          <p
            role="alert"
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
          >
            {baseUrlWarningMessage}
          </p>
        )}
      </div>
      <ApiConnectionTester
        onTest={onTestConnection}
        testStatus={testStatus}
        testMessage={testMessage}
        isTestDisabled={testStatus === 'testing' || (!openaiCompatibleApiKey && !hasOpenAIEnvKey)}
      />
    </div>
  );
};
