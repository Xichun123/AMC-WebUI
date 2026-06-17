import { describe, expect, it } from 'vitest';
import { buildLiveTranslateConfig } from './useLiveTranslateConfig';

describe('buildLiveTranslateConfig', () => {
  it('emits translationConfig with the BCP-47 target language code', () => {
    const config = buildLiveTranslateConfig({ targetLanguageCode: 'zh-Hans' });

    expect(config.translationConfig).toEqual({
      targetLanguageCode: 'zh-Hans',
      echoTargetLanguage: false,
    });
  });

  it('requests AUDIO modality only', () => {
    const config = buildLiveTranslateConfig({ targetLanguageCode: 'en' });
    expect(config.responseModalities).toEqual(['AUDIO']);
  });

  it('enables input and output transcription to capture source/translated text', () => {
    const config = buildLiveTranslateConfig({ targetLanguageCode: 'ja' });

    expect(config.inputAudioTranscription).toEqual({});
    expect(config.outputAudioTranscription).toEqual({});
  });

  it('defaults echoTargetLanguage to false', () => {
    const config = buildLiveTranslateConfig({ targetLanguageCode: 'en' });
    expect(config.translationConfig.echoTargetLanguage).toBe(false);
  });

  it('honours an explicitly enabled echoTargetLanguage', () => {
    const config = buildLiveTranslateConfig({ targetLanguageCode: 'en', echoTargetLanguage: true });
    expect(config.translationConfig.echoTargetLanguage).toBe(true);
  });

  it('omits voiceConfig, tools, contextWindowCompression, and thinking', () => {
    const config = buildLiveTranslateConfig({ targetLanguageCode: 'en' });

    expect(config).not.toHaveProperty('speechConfig');
    expect(config).not.toHaveProperty('tools');
    expect(config).not.toHaveProperty('contextWindowCompression');
    expect(config).not.toHaveProperty('thinkingConfig');
    expect(config).not.toHaveProperty('systemInstruction');
  });
});
