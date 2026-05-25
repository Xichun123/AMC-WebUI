import { getRuntimeConfigAppSettingsOverrides } from '@/runtime/runtimeConfig';
import { MediaResolution, type AppSettings, type FilesApiConfig, type ModelOption, type ThinkingLevel } from '@/types';
import { DEFAULT_OPENAI_COMPATIBLE_BASE_URL } from '@/utils/apiProxyUrl';
import { createEmptyLiveArtifactsSystemPrompts } from '@/utils/liveArtifactsPromptSettings';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_SHOW_THOUGHTS,
  DEFAULT_TEMPERATURE,
  DEFAULT_THINKING_BUDGET,
  DEFAULT_THINKING_LEVEL,
  DEFAULT_THOUGHT_TRANSLATION_MODEL_ID,
  DEFAULT_TOP_K,
  DEFAULT_TOP_P,
  DEFAULT_TRANSCRIPTION_MODEL_ID,
  DEFAULT_TTS_VOICE,
} from './modelConfiguration';
import { DEFAULT_SAFETY_SETTINGS } from './safetySettings';
import { DEFAULT_THOUGHT_TRANSLATION_TARGET_LANGUAGE, DEFAULT_TRANSLATION_TARGET_LANGUAGE } from './translationOptions';

export const DEFAULT_SYSTEM_INSTRUCTION = '';

const DEFAULT_IS_STREAMING_ENABLED = true;
const DEFAULT_BASE_FONT_SIZE = 16;
const DEFAULT_IS_AUDIO_COMPRESSION_ENABLED = true;
const DEFAULT_IS_OPENAI_COMPATIBLE_API_ENABLED = false;
const DEFAULT_OPENAI_COMPATIBLE_MODEL_ID = 'gpt-5.5';
const DEFAULT_OPENAI_COMPATIBLE_MODELS: ModelOption[] = [
  { id: DEFAULT_OPENAI_COMPATIBLE_MODEL_ID, name: 'GPT-5.5', isPinned: true },
];
const DEFAULT_MEDIA_RESOLUTION = MediaResolution.MEDIA_RESOLUTION_UNSPECIFIED;

export const DEFAULT_FILES_API_CONFIG: FilesApiConfig = {
  images: false,
  pdfs: true,
  audio: true,
  video: true,
  text: false,
};

export const DEFAULT_CHAT_SETTINGS = {
  modelId: DEFAULT_MODEL_ID,
  temperature: DEFAULT_TEMPERATURE,
  topP: DEFAULT_TOP_P,
  topK: DEFAULT_TOP_K,
  showThoughts: DEFAULT_SHOW_THOUGHTS,
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  ttsVoice: DEFAULT_TTS_VOICE,
  thinkingBudget: DEFAULT_THINKING_BUDGET,
  thinkingLevel: DEFAULT_THINKING_LEVEL as ThinkingLevel,
  lockedApiKey: null,
  isGoogleSearchEnabled: false,
  isCodeExecutionEnabled: false,
  isUrlContextEnabled: false,
  isDeepSearchEnabled: false,
  isRawModeEnabled: false,
  hideThinkingInContext: false,
  safetySettings: DEFAULT_SAFETY_SETTINGS,
  mediaResolution: DEFAULT_MEDIA_RESOLUTION,
};

const BASE_DEFAULT_APP_SETTINGS: AppSettings = {
  ...DEFAULT_CHAT_SETTINGS,
  themeId: 'pearl',
  baseFontSize: DEFAULT_BASE_FONT_SIZE,
  apiMode: 'gemini-native',
  isOpenAICompatibleApiEnabled: DEFAULT_IS_OPENAI_COMPATIBLE_API_ENABLED,
  useCustomApiConfig: false,
  serverManagedApi: false,
  apiKey: null,
  apiProxyUrl: 'https://api-proxy.de/gemini',
  openaiCompatibleApiKey: null,
  openaiCompatibleBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  openaiCompatibleModelId: DEFAULT_OPENAI_COMPATIBLE_MODEL_ID,
  openaiCompatibleModels: DEFAULT_OPENAI_COMPATIBLE_MODELS,
  useApiProxy: false,
  language: 'system',
  translationTargetLanguage: DEFAULT_TRANSLATION_TARGET_LANGUAGE,
  inputTranslationModelId: DEFAULT_THOUGHT_TRANSLATION_MODEL_ID,
  thoughtTranslationTargetLanguage: DEFAULT_THOUGHT_TRANSLATION_TARGET_LANGUAGE,
  thoughtTranslationModelId: DEFAULT_THOUGHT_TRANSLATION_MODEL_ID,
  showInputTranslationButton: false,
  isStreamingEnabled: DEFAULT_IS_STREAMING_ENABLED,
  transcriptionModelId: DEFAULT_TRANSCRIPTION_MODEL_ID,
  filesApiConfig: DEFAULT_FILES_API_CONFIG,
  expandCodeBlocksByDefault: false,
  isAutoTitleEnabled: true,
  isMermaidRenderingEnabled: true,
  isGraphvizRenderingEnabled: true,
  isCompletionNotificationEnabled: false,
  isCompletionSoundEnabled: false,
  isSuggestionsEnabled: true,
  isAutoScrollOnSendEnabled: true,
  isAutoSendOnSuggestionClick: true,
  generateQuadImages: false,
  autoFullscreenHtml: true,
  showWelcomeSuggestions: true,
  isAudioCompressionEnabled: DEFAULT_IS_AUDIO_COMPRESSION_ENABLED,
  liveArtifactsPromptMode: 'inline',
  liveArtifactsSystemPrompt: '',
  liveArtifactsSystemPrompts: createEmptyLiveArtifactsSystemPrompts(),
  isPasteRichTextAsMarkdownEnabled: true,
  isPasteAsTextFileEnabled: true,
  showInputPasteButton: true,
  showInputClearButton: true,
  isCopySelectionFormattingEnabled: true,
  isSystemAudioRecordingEnabled: false,
  mcpServers: [],
  customShortcuts: {},
  tabModelCycleIds: undefined,
};

export function getDefaultAppSettings(): AppSettings {
  return {
    ...BASE_DEFAULT_APP_SETTINGS,
    ...getRuntimeConfigAppSettingsOverrides(),
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = getDefaultAppSettings();
