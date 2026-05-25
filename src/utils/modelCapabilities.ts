import { REQUIRED_THINKING_MODEL_IDS, MODELS_SUPPORTING_RAW_MODE } from '@/constants/modelConfiguration';
import type { ThinkingLevel } from '@/types';

export const isGemini3Model = (modelId: string): boolean => {
  if (!modelId) return false;
  const lowerId = modelId.toLowerCase();
  return (
    REQUIRED_THINKING_MODEL_IDS.some((model) => lowerId.includes(model)) ||
    lowerId.includes('gemini-3-pro') ||
    lowerId.includes('gemini-3.1-flash')
  );
};

export const isGemmaModel = (modelId: string): boolean => !!modelId && modelId.toLowerCase().includes('gemma');

export const isGeminiRoboticsModel = (modelId: string): boolean =>
  !!modelId && modelId.toLowerCase().includes('gemini-robotics-er');

const isNativeAudioModel = (modelId: string): boolean => {
  const lowerId = modelId.toLowerCase();
  return lowerId.includes('native-audio') || lowerId.includes('-live-');
};

const isGemini31FlashLiveModel = (modelId: string): boolean => modelId.toLowerCase().includes('gemini-3.1-flash-live');

const isGemini31FlashImageModel = (modelId: string): boolean =>
  modelId.toLowerCase().includes('gemini-3.1-flash-image');

const isTtsModel = (modelId: string): boolean => modelId.toLowerCase().includes('tts');

const supportsThinkingLevel = (modelId: string): boolean =>
  !isTtsModel(modelId) && (isGemini3Model(modelId) || isGeminiRoboticsModel(modelId));

const isGemini3ImageModel = (modelId: string): boolean =>
  modelId === 'gemini-3-pro-image-preview' || modelId === 'gemini-3.1-flash-image-preview';

const isFlashImageModel = (modelId: string): boolean => modelId.toLowerCase().includes('gemini-2.5-flash-image');

const isRealImagenModel = (modelId: string): boolean => modelId.toLowerCase().includes('imagen');

export const isImageGenerationModel = (modelId: string): boolean =>
  isRealImagenModel(modelId) ||
  isFlashImageModel(modelId) ||
  isGemini3ImageModel(modelId) ||
  (modelId.toLowerCase().includes('image') && !modelId.toLowerCase().includes('imagen'));

export interface ModelInteractionPermissions {
  canAcceptAttachments: boolean;
  canUseTools: boolean;
  canUseGoogleSearch: boolean;
  canUseDeepSearch: boolean;
  canUseCodeExecution: boolean;
  canUseLocalPython: boolean;
  canUseUrlContext: boolean;
  canUseTokenCount: boolean;
  canUseYouTubeUrl: boolean;
  canGenerateSuggestions: boolean;
  canUseVoiceInput: boolean;
  canUseLiveControls: boolean;
  requiresTextPrompt: boolean;
}

export interface ModelCapabilities {
  isGemini3: boolean;
  supportsRawReasoningPrefill: boolean;
  supportsThinkingLevel: boolean;
  supportsThinkingBudgetConfig: boolean;
  isGemmaModel: boolean;
  isFlashModel: boolean;
  isGemini25Model: boolean;
  isGemini3FlashModel: boolean;
  isGemini31FlashLiveModel: boolean;
  isGemini31FlashImageModel: boolean;
  isGeminiRoboticsModel: boolean;
  isGemini3ImageModel: boolean;
  isFlashImageModel: boolean;
  isRealImagenModel: boolean;
  isImageGenerationModel: boolean;
  isTtsModel: boolean;
  isNativeAudioModel: boolean;
  supportsBuiltInCustomToolCombination: boolean;
  permissions: ModelInteractionPermissions;
  supportedAspectRatios?: string[];
  supportedImageSizes?: string[];
}

export const getModelCapabilities = (modelId: string): ModelCapabilities => {
  const lowerId = modelId.toLowerCase();
  const isGemini3 = isGemini3Model(modelId);
  const supportsThinkingLevelSelection = supportsThinkingLevel(modelId);
  const gemini3ImageModel = isGemini3ImageModel(modelId);
  const flashImageModel = isFlashImageModel(modelId);
  const realImagenModel = isRealImagenModel(modelId);
  const ttsModel = isTtsModel(modelId);
  const nativeAudioModel = isNativeAudioModel(modelId);
  const flashModel = lowerId.includes('flash');
  const gemini25Model = lowerId.includes('gemini-2.5');
  const gemini3FlashModel = isGemini3 && flashModel;
  const gemini31FlashLiveModel = isGemini31FlashLiveModel(modelId);
  const roboticsModel = isGeminiRoboticsModel(modelId);
  const imageGenerationModel = realImagenModel || flashImageModel || gemini3ImageModel;
  const canUseTextChatTools = !nativeAudioModel && !imageGenerationModel && !ttsModel;
  const permissions: ModelInteractionPermissions = {
    canAcceptAttachments: !realImagenModel && !ttsModel && !nativeAudioModel,
    canUseTools: canUseTextChatTools || nativeAudioModel || gemini3ImageModel || imageGenerationModel,
    canUseGoogleSearch: canUseTextChatTools || nativeAudioModel || gemini3ImageModel,
    canUseDeepSearch: canUseTextChatTools,
    canUseCodeExecution: canUseTextChatTools && !isGemmaModel(modelId),
    canUseLocalPython: canUseTextChatTools || nativeAudioModel,
    canUseUrlContext: canUseTextChatTools && !isGemmaModel(modelId),
    canUseTokenCount: !nativeAudioModel,
    canUseYouTubeUrl: canUseTextChatTools,
    canGenerateSuggestions: canUseTextChatTools,
    canUseVoiceInput: !nativeAudioModel && !imageGenerationModel && !ttsModel,
    canUseLiveControls: nativeAudioModel,
    requiresTextPrompt: ttsModel || imageGenerationModel,
  };

  let supportedAspectRatios: string[] | undefined;
  if (realImagenModel) {
    supportedAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
  } else if (isGemini31FlashImageModel(modelId)) {
    supportedAspectRatios = [
      'Auto',
      '1:1',
      '1:4',
      '1:8',
      '16:9',
      '9:16',
      '4:1',
      '4:3',
      '3:4',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '8:1',
      '21:9',
    ];
  } else if (gemini3ImageModel || flashImageModel) {
    supportedAspectRatios = ['Auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9'];
  }

  let supportedImageSizes: string[] | undefined;
  if (isGemini31FlashImageModel(modelId)) {
    supportedImageSizes = ['512', '1K', '2K', '4K'];
  } else if (gemini3ImageModel) {
    supportedImageSizes = ['1K', '2K', '4K'];
  } else if (realImagenModel && !modelId.toLowerCase().includes('fast')) {
    supportedImageSizes = ['1K', '2K'];
  }

  return {
    isGemini3,
    supportsRawReasoningPrefill: MODELS_SUPPORTING_RAW_MODE.some((model) => modelId.includes(model)),
    supportsThinkingLevel: supportsThinkingLevelSelection,
    supportsThinkingBudgetConfig: gemini25Model || roboticsModel,
    isGemmaModel: isGemmaModel(modelId),
    isFlashModel: flashModel,
    isGemini25Model: gemini25Model,
    isGemini3FlashModel: gemini3FlashModel,
    isGemini31FlashLiveModel: gemini31FlashLiveModel,
    isGemini31FlashImageModel: isGemini31FlashImageModel(modelId),
    isGeminiRoboticsModel: roboticsModel,
    isGemini3ImageModel: gemini3ImageModel,
    isFlashImageModel: flashImageModel,
    isRealImagenModel: realImagenModel,
    isImageGenerationModel: imageGenerationModel,
    isTtsModel: ttsModel,
    isNativeAudioModel: nativeAudioModel,
    supportsBuiltInCustomToolCombination: isGemini3,
    permissions,
    supportedAspectRatios,
    supportedImageSizes,
  };
};

export const normalizeAspectRatioForModel = (modelId: string, aspectRatio?: string): string | undefined => {
  const supportedAspectRatios = getModelCapabilities(modelId).supportedAspectRatios;

  if (!supportedAspectRatios || supportedAspectRatios.length === 0) {
    return aspectRatio;
  }

  if (aspectRatio && supportedAspectRatios.includes(aspectRatio)) {
    return aspectRatio;
  }

  return supportedAspectRatios[0];
};

export const normalizeImageSizeForModel = (modelId: string, imageSize?: string): string | undefined => {
  const supportedImageSizes = getModelCapabilities(modelId).supportedImageSizes;

  if (!supportedImageSizes || supportedImageSizes.length === 0) {
    return undefined;
  }

  if (imageSize && supportedImageSizes.includes(imageSize)) {
    return imageSize;
  }

  return supportedImageSizes[0];
};

export const getDefaultThinkingLevelForModel = (modelId: string, fallback: ThinkingLevel = 'HIGH'): ThinkingLevel => {
  if (isGemini31FlashLiveModel(modelId) || isGemini31FlashImageModel(modelId)) {
    return 'MINIMAL';
  }

  return normalizeThinkingLevelForModel(modelId, fallback) ?? fallback;
};

export const normalizeThinkingLevelForModel = (
  modelId: string,
  thinkingLevel?: ThinkingLevel,
  fallback: ThinkingLevel = 'HIGH',
): ThinkingLevel | undefined => {
  const resolvedLevel = thinkingLevel ?? fallback;

  if (resolvedLevel !== 'MINIMAL') {
    return resolvedLevel;
  }

  const capabilities = getModelCapabilities(modelId);
  if (capabilities.isGemini31FlashImageModel || capabilities.isGemini31FlashLiveModel) {
    return 'MINIMAL';
  }

  if (capabilities.supportsThinkingLevel && !capabilities.isGemini3FlashModel && !capabilities.isGeminiRoboticsModel) {
    return 'LOW';
  }

  return resolvedLevel;
};

export const shouldStripThinkingFromContext = (modelId: string, hideThinkingInContext?: boolean): boolean => {
  if (hideThinkingInContext) {
    return true;
  }

  return isGemmaModel(modelId);
};
