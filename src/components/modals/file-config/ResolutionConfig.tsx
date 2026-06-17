import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Image as ImageIcon } from 'lucide-react';
import { MediaResolution } from '@/types';
import { Select } from '@/components/shared/Select';

interface ResolutionConfigProps {
  mediaResolution: MediaResolution | '';
  setMediaResolution: (value: MediaResolution) => void;
  allowUltraHigh?: boolean;
}

export const ResolutionConfig: React.FC<ResolutionConfigProps> = ({
  mediaResolution,
  setMediaResolution,
  allowUltraHigh = true,
}) => {
  const { t } = useI18n();
  return (
    <div className="space-y-3 pb-4 border-b border-[var(--theme-border-secondary)]/50">
      <Select
        id="file-media-resolution"
        label={t('fileSettingsResolution')}
        layout="horizontal"
        value={mediaResolution}
        onChange={(e) => setMediaResolution(e.target.value as MediaResolution)}
        labelContent={
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-[var(--theme-text-secondary)]" />
            <span>{t('fileSettingsResolution')}</span>
          </div>
        }
      >
        <option value="">{t('mediaResolutionUnspecified')}</option>
        <option value={MediaResolution.MEDIA_RESOLUTION_LOW}>{t('mediaResolutionLow')}</option>
        <option value={MediaResolution.MEDIA_RESOLUTION_MEDIUM}>{t('mediaResolutionMedium')}</option>
        <option value={MediaResolution.MEDIA_RESOLUTION_HIGH}>{t('mediaResolutionHigh')}</option>
        {allowUltraHigh && (
          <option value={MediaResolution.MEDIA_RESOLUTION_ULTRA_HIGH}>{t('mediaResolutionUltraHigh')}</option>
        )}
      </Select>
      <p className="text-[10px] text-[var(--theme-text-tertiary)] italic">{t('fileSettingsResolutionHelp')}</p>
    </div>
  );
};
