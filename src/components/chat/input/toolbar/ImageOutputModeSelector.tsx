import React from 'react';
import { useI18n } from '@/contexts/I18nContext';
import type { ImageOutputMode } from '@/types';
import { Select } from '@/components/shared/Select';

interface ImageOutputModeSelectorProps {
  imageOutputMode: ImageOutputMode;
  setImageOutputMode: (mode: ImageOutputMode) => void;
}

export const ImageOutputModeSelector: React.FC<ImageOutputModeSelectorProps> = ({
  imageOutputMode,
  setImageOutputMode,
}) => {
  const { t } = useI18n();
  return (
    <Select
      id="image-output-mode-selector"
      label={t('imageOutputModeTitle')}
      hideLabel
      value={imageOutputMode}
      onChange={(e) => setImageOutputMode(e.target.value as ImageOutputMode)}
      className="mb-0"
      wrapperClassName="relative w-[150px]"
      direction="up"
    >
      <option value="IMAGE_TEXT">{t('imageOutputModeTextAndImage')}</option>
      <option value="IMAGE_ONLY">{t('imageOutputModeImageOnly')}</option>
    </Select>
  );
};
