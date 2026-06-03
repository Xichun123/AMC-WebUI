import { appTranslations } from './translations/app';
import { headerTranslations } from './translations/header';
import { chatInputTranslations } from './translations/chatInput';
import { messagesTranslations } from './translations/messages';
import { historyTranslations } from './translations/history';
import { commonTranslations } from './translations/common';
import { ttsStyleTranslations } from './voiceStyleTranslations';

export type SupportedLanguage = 'en' | 'zh';
export type TranslationEntry = Partial<Record<SupportedLanguage, string>>;
export type TranslationMap = Record<string, TranslationEntry>;

const shellFeatureTranslations: TranslationMap = {
  settingsTitle: { en: 'Settings', zh: '设置' },
  settingsTtsVoice: { en: 'Speech Voice', zh: '语音音色' },
  settingsMediaResolution: { en: 'Input Detail Level', zh: '输入细节等级' },
  mediaResolution_unspecified: { en: 'Auto (Default)', zh: '自动（默认）' },
  mediaResolution_low: { en: 'Low (Faster)', zh: '低（较快）' },
  mediaResolution_medium: { en: 'Medium (Balanced)', zh: '中（平衡）' },
  mediaResolution_high: { en: 'High (Detail)', zh: '高（细节）' },
  mediaResolution_ultra_high: { en: 'Ultra High (Images only)', zh: '超高（仅限图片）' },
  settings_generateQuadImages_tooltip: {
    en: 'When enabled, prompts sent to an Imagen model will generate four independent image variations at once. This will consume more API credits.',
    zh: '启用后，使用 Imagen 模型将一次性生成四张独立的图片变体。这将消耗更多 API 用量。',
  },
  about_update_ready: { en: 'Update ready to refresh', zh: '发现可用更新' },
  pwaUpdate_refresh_prompt: {
    en: 'Refresh to update the installed shell and latest assets.',
    zh: '刷新以更新已安装的应用外壳和最新资源。',
  },
  pwaUpdate_later: { en: 'Later', zh: '稍后' },
  ...ttsStyleTranslations,
};

export const translations: TranslationMap = {
  ...appTranslations,
  ...headerTranslations,
  ...chatInputTranslations,
  ...messagesTranslations,
  ...historyTranslations,
  ...commonTranslations,
  ...shellFeatureTranslations,
};

export const registerTranslations = (translationMap: TranslationMap) => {
  Object.assign(translations, translationMap);
};

export const getTranslator =
  (lang: SupportedLanguage) =>
  (key: keyof typeof translations | string, fallback?: string): string => {
    const translationSet = translations as TranslationMap;
    return translationSet[key]?.[lang] ?? fallback ?? translationSet[key]?.en ?? key;
  };
