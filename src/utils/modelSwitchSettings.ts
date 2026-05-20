import { MODELS_MANDATORY_THINKING, THINKING_BUDGET_RANGES } from '@/constants/modelConstants';
import { useModelPreferencesStore, type CachedModelSettings } from '@/stores/modelPreferencesStore';
import { MediaResolution } from '@/types';

import { getDefaultThinkingLevelForModel, isGemini3Model } from './modelCapabilities';

type SwitchableModelSettings = CachedModelSettings & {
  modelId?: string;
  thinkingBudget: number;
};

const getCachedModelSettings = (modelId: string): CachedModelSettings | undefined => {
  useModelPreferencesStore.getState().hydrateLegacyModelPreferences();
  return useModelPreferencesStore.getState().getCachedModelSettings(modelId);
};

const cacheModelSettings = (modelId: string, settings: CachedModelSettings) => {
  if (!modelId) return;
  useModelPreferencesStore.getState().hydrateLegacyModelPreferences();
  useModelPreferencesStore.getState().cacheModelSettings(modelId, settings);
};

const adjustThinkingBudget = (modelId: string, currentBudget: number): number => {
  const range = THINKING_BUDGET_RANGES[modelId];
  let newBudget = currentBudget;

  if (range) {
    const isGemini3 = isGemini3Model(modelId);
    const isMandatory = MODELS_MANDATORY_THINKING.includes(modelId);

    if (isMandatory && newBudget === 0) {
      newBudget = isGemini3 ? -1 : range.max;
    }

    if (newBudget > 0) {
      if (newBudget > range.max) newBudget = range.max;
      if (newBudget < range.min) newBudget = range.min;
    }
  }
  return newBudget;
};

export const resolveModelSwitchSettings = ({
  currentSettings,
  sourceSettings,
  targetModelId,
}: {
  currentSettings: SwitchableModelSettings;
  sourceSettings: SwitchableModelSettings;
  targetModelId: string;
}) => {
  if (currentSettings.modelId) {
    cacheModelSettings(currentSettings.modelId, {
      mediaResolution: currentSettings.mediaResolution,
      thinkingBudget: currentSettings.thinkingBudget,
      thinkingLevel: currentSettings.thinkingLevel,
    });
  }

  const cached = getCachedModelSettings(targetModelId);
  const mediaResolution =
    cached?.mediaResolution ?? sourceSettings.mediaResolution ?? MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED;
  const thinkingLevel =
    cached?.thinkingLevel ?? getDefaultThinkingLevelForModel(targetModelId, sourceSettings.thinkingLevel);
  const thinkingBudget = adjustThinkingBudget(targetModelId, cached?.thinkingBudget ?? sourceSettings.thinkingBudget);

  return {
    modelId: targetModelId,
    thinkingBudget,
    thinkingLevel,
    mediaResolution,
  };
};
