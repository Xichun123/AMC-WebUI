interface LiveTranslateLanguageSettings {
  targetLanguageCode: string; // BCP-47 代码，如 'zh-Hans' / 'en' / 'ja'
  echoTargetLanguage?: boolean; // 输入已是目标语言时是否回放原声，默认 false
}

export interface LiveTranslateConfig {
  responseModalities: ['AUDIO'];
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  translationConfig: {
    targetLanguageCode: string;
    echoTargetLanguage: boolean;
  };
}

/**
 * 为 Live Translate 模型构建 config。
 *
 * 对照官方文档（gemini-3.5-live-translate-preview）：
 *   - 翻译方向通过 generationConfig.translationConfig.targetLanguageCode（BCP-47）配置，
 *     不是 systemInstruction —— 该模型是音频专用模型，不读文本指令。
 *   - 源语言由模型自动检测，无需配置。
 *   - 开启 input/output transcription 以拿到原文与译文文字。
 *   - 不需要 voiceConfig / tools / contextWindowCompression / thinkingConfig
 *     （翻译专用模型，音频沿用源说话人音色）。
 */
export const buildLiveTranslateConfig = ({
  targetLanguageCode,
  echoTargetLanguage = false,
}: LiveTranslateLanguageSettings): LiveTranslateConfig => ({
  responseModalities: ['AUDIO'],
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  translationConfig: {
    targetLanguageCode,
    echoTargetLanguage,
  },
});
