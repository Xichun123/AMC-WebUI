import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Settings2, Zap } from 'lucide-react';
import { MediaResolution } from '@/types';
import { Select } from '@/components/shared/Select';

interface MediaResolutionSelectorProps {
  mediaResolution: MediaResolution;
  setMediaResolution: (resolution: MediaResolution) => void;
  isNativeAudioModel?: boolean;
}

export const MediaResolutionSelector: React.FC<MediaResolutionSelectorProps> = ({
  mediaResolution,
  setMediaResolution,
  isNativeAudioModel,
}) => {
  const { t } = useI18n();
  const standardOptions = [
    { value: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED, label: t('mediaResolutionUnspecified') },
    { value: MediaResolution.MEDIA_RESOLUTION_LOW, label: t('mediaResolutionLow') },
    { value: MediaResolution.MEDIA_RESOLUTION_MEDIUM, label: t('mediaResolutionMedium') },
    { value: MediaResolution.MEDIA_RESOLUTION_HIGH, label: t('mediaResolutionHigh') },
    { value: MediaResolution.MEDIA_RESOLUTION_ULTRA_HIGH, label: t('mediaResolutionUltraHigh') },
  ];

  const liveOptions = [
    { value: MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED, label: '258 tokens / image' },
    { value: MediaResolution.MEDIA_RESOLUTION_LOW, label: '66 tokens / image' },
  ];

  const options = isNativeAudioModel ? liveOptions : standardOptions;

  return (
    <Select
      id="media-resolution-selector"
      label={t('settingsMediaResolution')}
      hideLabel
      value={mediaResolution}
      onChange={(e) => setMediaResolution(e.target.value as MediaResolution)}
      className="mb-0"
      wrapperClassName="relative min-w-[180px] w-auto"
      direction="up"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          <div className="flex items-center gap-2">
            {isNativeAudioModel ? (
              <Zap size={14} className="text-amber-500" />
            ) : (
              <Settings2 size={14} className="text-blue-500" />
            )}
            <span>{option.label}</span>
          </div>
        </option>
      ))}
    </Select>
  );
};
