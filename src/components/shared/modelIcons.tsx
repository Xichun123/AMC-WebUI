import { AudioWaveform, Banana, Box, Image as ImageIcon, Layers3, ScanEye, Sparkles, Speech } from 'lucide-react';

import { getCachedModelCapabilities } from '@/stores/modelCapabilitiesStore';
import { isGeminiRoboticsModel } from '@/utils/modelCapabilities';
import { type ModelOption } from '@/types';

const MODEL_ICON_SIZE = 18;

export const getModelIcon = (model: ModelOption | undefined) => {
  if (!model) return <Box size={MODEL_ICON_SIZE} className="text-[var(--theme-text-tertiary)]" strokeWidth={1.5} />;
  const { id, isPinned } = model;
  const normalizedId = id.toLowerCase();
  const { isNativeAudioModel, isTtsModel, isRealImagenModel, isGemini3ImageModel, isFlashImageModel, isGemmaModel } =
    getCachedModelCapabilities(id);

  if (isNativeAudioModel) {
    return (
      <AudioWaveform
        size={MODEL_ICON_SIZE}
        className="text-amber-500 dark:text-amber-400 flex-shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  if (isTtsModel) {
    return (
      <Speech size={MODEL_ICON_SIZE} className="text-purple-500 dark:text-purple-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isRealImagenModel) {
    return (
      <ImageIcon size={MODEL_ICON_SIZE} className="text-rose-500 dark:text-rose-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isGemini3ImageModel || isFlashImageModel) {
    return (
      <Banana size={MODEL_ICON_SIZE} className="text-yellow-500 dark:text-yellow-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isGeminiRoboticsModel(id)) {
    return (
      <ScanEye
        size={MODEL_ICON_SIZE}
        className="text-emerald-500 dark:text-emerald-400 flex-shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  if (isGemmaModel) {
    return (
      <Layers3
        size={MODEL_ICON_SIZE}
        className="text-violet-500 dark:text-violet-400 flex-shrink-0"
        strokeWidth={1.5}
      />
    );
  }

  if (normalizedId.includes('gemini')) {
    return (
      <Sparkles size={MODEL_ICON_SIZE} className="text-sky-500 dark:text-sky-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  if (isPinned) {
    return (
      <Sparkles size={MODEL_ICON_SIZE} className="text-sky-500 dark:text-sky-400 flex-shrink-0" strokeWidth={1.5} />
    );
  }

  return (
    <Box
      size={MODEL_ICON_SIZE}
      className="text-[var(--theme-text-tertiary)] opacity-70 flex-shrink-0"
      strokeWidth={1.5}
    />
  );
};
