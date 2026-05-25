import type { TranslationTargetLanguage } from '@/types';

export const DEFAULT_TRANSLATION_TARGET_LANGUAGE: TranslationTargetLanguage = 'English';
export const DEFAULT_THOUGHT_TRANSLATION_TARGET_LANGUAGE: TranslationTargetLanguage = 'Simplified Chinese';

export const TRANSLATION_TARGET_LANGUAGE_OPTIONS: Array<{
  value: TranslationTargetLanguage;
  labelKey: string;
}> = [
  { value: 'English', labelKey: 'translationTargetLanguage_english' },
  { value: 'Simplified Chinese', labelKey: 'translationTargetLanguage_simplifiedChinese' },
  { value: 'Traditional Chinese', labelKey: 'translationTargetLanguage_traditionalChinese' },
  { value: 'Japanese', labelKey: 'translationTargetLanguage_japanese' },
  { value: 'Korean', labelKey: 'translationTargetLanguage_korean' },
  { value: 'Spanish', labelKey: 'translationTargetLanguage_spanish' },
  { value: 'French', labelKey: 'translationTargetLanguage_french' },
  { value: 'German', labelKey: 'translationTargetLanguage_german' },
];
