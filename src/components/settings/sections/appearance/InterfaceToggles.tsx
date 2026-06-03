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
        alert(t('settings_notificationsUnsupported'));
        return;
      }

      if (Notification.permission === 'denied') {
        alert(t('settings_notificationsBlocked'));
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
            label={t('settings_showInputTranslationButton_label')}
            checked={settings.showInputTranslationButton ?? false}
            onChange={(enabled) => onUpdate('showInputTranslationButton', enabled)}
            tooltip={t('settings_showInputTranslationButton_tooltip')}
          />
          <ToggleItem
            label={t('settings_showInputPasteButton_label')}
            checked={settings.showInputPasteButton ?? true}
            onChange={(enabled) => onUpdate('showInputPasteButton', enabled)}
            tooltip={t('settings_showInputPasteButton_tooltip')}
          />
          <ToggleItem
            label={t('settings_showInputClearButton_label')}
            checked={settings.showInputClearButton ?? true}
            onChange={(enabled) => onUpdate('showInputClearButton', enabled)}
            tooltip={t('settings_showInputClearButton_tooltip')}
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
            label={t('settings_pasteRichTextAsMarkdown_label')}
            checked={settings.isPasteRichTextAsMarkdownEnabled ?? true}
            onChange={(enabled) => onUpdate('isPasteRichTextAsMarkdownEnabled', enabled)}
            tooltip={t('settings_pasteRichTextAsMarkdown_tooltip')}
          />
          <ToggleItem
            label={t('settings_pasteAsTextFile_label')}
            checked={settings.isPasteAsTextFileEnabled ?? true}
            onChange={(enabled) => onUpdate('isPasteAsTextFileEnabled', enabled)}
            tooltip={t('settings_pasteAsTextFile_tooltip')}
          />
          <ToggleItem
            label={t('settings_copySelectionFormatting_label')}
            checked={settings.isCopySelectionFormattingEnabled ?? true}
            onChange={(enabled) => onUpdate('isCopySelectionFormattingEnabled', enabled)}
            tooltip={t('settings_copySelectionFormatting_tooltip')}
          />

          <ToggleItem
            label={t('isAutoTitleEnabled')}
            checked={settings.isAutoTitleEnabled}
            onChange={(enabled) => onUpdate('isAutoTitleEnabled', enabled)}
          />

          <ToggleItem
            label={t('settings_enableSuggestions_label')}
            checked={settings.isSuggestionsEnabled}
            onChange={(enabled) => onUpdate('isSuggestionsEnabled', enabled)}
            tooltip={t('settings_enableSuggestions_tooltip')}
          />

          <ToggleItem
            label={t('settings_autoScrollOnSend_label')}
            checked={settings.isAutoScrollOnSendEnabled ?? true}
            onChange={(enabled) => onUpdate('isAutoScrollOnSendEnabled', enabled)}
          />
          <ToggleItem
            label={t('settings_enableCompletionNotification_label')}
            checked={settings.isCompletionNotificationEnabled}
            onChange={handleNotificationToggle}
            tooltip={t('settings_enableCompletionNotification_tooltip')}
          />
          <ToggleItem
            label={t('settings_enableCompletionSound_label')}
            checked={settings.isCompletionSoundEnabled ?? false}
            onChange={(enabled) => onUpdate('isCompletionSoundEnabled', enabled)}
            tooltip={t('settings_enableCompletionSound_tooltip')}
          />
          <ToggleItem
            label={t('settings_expandCodeBlocksByDefault_label')}
            checked={settings.expandCodeBlocksByDefault}
            onChange={(enabled) => onUpdate('expandCodeBlocksByDefault', enabled)}
          />
          <ToggleItem
            label={t('settings_autoFullscreenHtml_label')}
            checked={settings.autoFullscreenHtml ?? true}
            onChange={(enabled) => onUpdate('autoFullscreenHtml', enabled)}
            tooltip={t('settings_autoFullscreenHtml_tooltip')}
          />
          <ToggleItem
            label={t('settings_enableMermaidRendering_label')}
            checked={settings.isMermaidRenderingEnabled}
            onChange={(enabled) => onUpdate('isMermaidRenderingEnabled', enabled)}
            tooltip={t('settings_enableMermaidRendering_tooltip')}
          />
          <ToggleItem
            label={t('settings_enableGraphvizRendering_label')}
            checked={settings.isGraphvizRenderingEnabled ?? true}
            onChange={(enabled) => onUpdate('isGraphvizRenderingEnabled', enabled)}
            tooltip={t('settings_enableGraphvizRendering_tooltip')}
          />
          <ToggleItem
            label={t('settings_audioCompression_label')}
            checked={settings.isAudioCompressionEnabled}
            onChange={(enabled) => onUpdate('isAudioCompressionEnabled', enabled)}
            tooltip={t('settings_audioCompression_tooltip')}
          />
        </div>
      </div>
    </div>
  );
};
