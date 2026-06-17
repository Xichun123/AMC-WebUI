import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { ToggleItem } from '@/components/shared/ToggleItem';
import { type AppSettings } from '@/types';

interface InterfaceTogglesProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const InterfaceToggles: React.FC<InterfaceTogglesProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!('Notification' in window)) {
        alert(t('settingsNotificationsUnsupported'));
        return;
      }

      if (Notification.permission === 'denied') {
        alert(t('settingsNotificationsBlocked'));
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }
      }
    }
    onUpdate('isCompletionNotificationEnabled', enabled);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)] mb-2">
          {t('settingsInputToolbar')}
        </label>
        <div className="grid grid-cols-1 gap-1">
          <ToggleItem
            label={t('settingsShowInputTranslationButtonLabel')}
            checked={settings.showInputTranslationButton ?? false}
            onChange={(enabled) => onUpdate('showInputTranslationButton', enabled)}
            tooltip={t('settingsShowInputTranslationButtonTooltip')}
          />
          <ToggleItem
            label={t('settingsShowInputPasteButtonLabel')}
            checked={settings.showInputPasteButton ?? true}
            onChange={(enabled) => onUpdate('showInputPasteButton', enabled)}
            tooltip={t('settingsShowInputPasteButtonTooltip')}
          />
          <ToggleItem
            label={t('settingsShowInputClearButtonLabel')}
            checked={settings.showInputClearButton ?? true}
            onChange={(enabled) => onUpdate('showInputClearButton', enabled)}
            tooltip={t('settingsShowInputClearButtonTooltip')}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)] mb-2">
          {t('settingsBehaviorDisplay')}
        </label>
        <div className="grid grid-cols-1 gap-1">
          <ToggleItem
            label={t('headerStream')}
            checked={settings.isStreamingEnabled}
            onChange={(enabled) => onUpdate('isStreamingEnabled', enabled)}
          />
          <ToggleItem
            label={t('settingsPasteRichTextAsMarkdownLabel')}
            checked={settings.isPasteRichTextAsMarkdownEnabled ?? true}
            onChange={(enabled) => onUpdate('isPasteRichTextAsMarkdownEnabled', enabled)}
            tooltip={t('settingsPasteRichTextAsMarkdownTooltip')}
          />
          <ToggleItem
            label={t('settingsPasteAsTextFileLabel')}
            checked={settings.isPasteAsTextFileEnabled ?? true}
            onChange={(enabled) => onUpdate('isPasteAsTextFileEnabled', enabled)}
            tooltip={t('settingsPasteAsTextFileTooltip')}
          />
          <ToggleItem
            label={t('settingsCopySelectionFormattingLabel')}
            checked={settings.isCopySelectionFormattingEnabled ?? true}
            onChange={(enabled) => onUpdate('isCopySelectionFormattingEnabled', enabled)}
            tooltip={t('settingsCopySelectionFormattingTooltip')}
          />

          <ToggleItem
            label={t('isAutoTitleEnabled')}
            checked={settings.isAutoTitleEnabled}
            onChange={(enabled) => onUpdate('isAutoTitleEnabled', enabled)}
          />

          <ToggleItem
            label={t('settingsEnableSuggestionsLabel')}
            checked={settings.isSuggestionsEnabled}
            onChange={(enabled) => onUpdate('isSuggestionsEnabled', enabled)}
            tooltip={t('settingsEnableSuggestionsTooltip')}
          />

          <ToggleItem
            label={t('settingsAutoScrollOnSendLabel')}
            checked={settings.isAutoScrollOnSendEnabled ?? true}
            onChange={(enabled) => onUpdate('isAutoScrollOnSendEnabled', enabled)}
          />
          <ToggleItem
            label={t('settingsEnableCompletionNotificationLabel')}
            checked={settings.isCompletionNotificationEnabled}
            onChange={handleNotificationToggle}
            tooltip={t('settingsEnableCompletionNotificationTooltip')}
          />
          <ToggleItem
            label={t('settingsEnableCompletionSoundLabel')}
            checked={settings.isCompletionSoundEnabled ?? false}
            onChange={(enabled) => onUpdate('isCompletionSoundEnabled', enabled)}
            tooltip={t('settingsEnableCompletionSoundTooltip')}
          />
          <ToggleItem
            label={t('settingsExpandCodeBlocksByDefaultLabel')}
            checked={settings.expandCodeBlocksByDefault}
            onChange={(enabled) => onUpdate('expandCodeBlocksByDefault', enabled)}
          />
          <ToggleItem
            label={t('settingsAutoFullscreenHtmlLabel')}
            checked={settings.autoFullscreenHtml ?? true}
            onChange={(enabled) => onUpdate('autoFullscreenHtml', enabled)}
            tooltip={t('settingsAutoFullscreenHtmlTooltip')}
          />
          <ToggleItem
            label={t('settingsEnableMermaidRenderingLabel')}
            checked={settings.isMermaidRenderingEnabled}
            onChange={(enabled) => onUpdate('isMermaidRenderingEnabled', enabled)}
            tooltip={t('settingsEnableMermaidRenderingTooltip')}
          />
          <ToggleItem
            label={t('settingsEnableGraphvizRenderingLabel')}
            checked={settings.isGraphvizRenderingEnabled ?? true}
            onChange={(enabled) => onUpdate('isGraphvizRenderingEnabled', enabled)}
            tooltip={t('settingsEnableGraphvizRenderingTooltip')}
          />
          <ToggleItem
            label={t('settingsAudioCompressionLabel')}
            checked={settings.isAudioCompressionEnabled}
            onChange={(enabled) => onUpdate('isAudioCompressionEnabled', enabled)}
            tooltip={t('settingsAudioCompressionTooltip')}
          />
        </div>
      </div>
    </div>
  );
};
