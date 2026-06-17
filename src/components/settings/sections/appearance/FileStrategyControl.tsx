import React from 'react';
import { CloudUpload, Info } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { type FilesApiConfig, type AppSettings } from '@/types';
import { Tooltip } from '@/components/shared/Tooltip';
import { ToggleItem } from '@/components/shared/ToggleItem';

interface FileStrategyControlProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const FileStrategyControl: React.FC<FileStrategyControlProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const updateFileConfig = (key: keyof FilesApiConfig, enabled: boolean) => {
    onUpdate('filesApiConfig', { ...settings.filesApiConfig, [key]: enabled });
  };

  return (
    <div className="bg-[var(--theme-bg-tertiary)]/20 p-3 rounded-xl border border-[var(--theme-border-secondary)]/50">
      <div className="flex items-start justify-between mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)] flex items-center gap-2">
          <CloudUpload size={14} strokeWidth={1.5} />
          {t('settingsFilesApiTitle')}
        </label>
        <Tooltip text={t('settingsFilesApiTooltip')}>
          <Info size={14} className="text-[var(--theme-text-tertiary)] cursor-help" strokeWidth={1.5} />
        </Tooltip>
      </div>
      <p className="text-xs text-[var(--theme-text-secondary)] mb-3 leading-relaxed opacity-80">
        {t('settingsFilesApiDesc')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
        <ToggleItem
          label={t('settingsFilesApiImages')}
          checked={settings.filesApiConfig.images}
          onChange={(enabled) => updateFileConfig('images', enabled)}
          small
        />
        <ToggleItem
          label={t('settingsFilesApiPdfs')}
          checked={settings.filesApiConfig.pdfs}
          onChange={(enabled) => updateFileConfig('pdfs', enabled)}
          small
        />
        <ToggleItem
          label={t('settingsFilesApiAudio')}
          checked={settings.filesApiConfig.audio}
          onChange={(enabled) => updateFileConfig('audio', enabled)}
          small
        />
        <ToggleItem
          label={t('settingsFilesApiVideo')}
          checked={settings.filesApiConfig.video}
          onChange={(enabled) => updateFileConfig('video', enabled)}
          small
        />
        <ToggleItem
          label={t('settingsFilesApiText')}
          checked={settings.filesApiConfig.text}
          onChange={(enabled) => updateFileConfig('text', enabled)}
          small
        />
      </div>
    </div>
  );
};
