import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from './appConstants';

describe('DEFAULT_APP_SETTINGS', () => {
  it('defaults input toolbar visibility to translate off and edit helpers on', () => {
    expect(DEFAULT_APP_SETTINGS.showInputTranslationButton).toBe(false);
    expect(DEFAULT_APP_SETTINGS.showInputPasteButton).toBe(true);
    expect(DEFAULT_APP_SETTINGS.showInputClearButton).toBe(true);
  });

  it('defaults the Live Artifacts custom prompt to blank', () => {
    expect((DEFAULT_APP_SETTINGS as { liveArtifactsSystemPrompt?: string }).liveArtifactsSystemPrompt).toBe('');
    expect(
      (
        DEFAULT_APP_SETTINGS as {
          liveArtifactsSystemPrompts?: Record<string, string>;
        }
      ).liveArtifactsSystemPrompts,
    ).toEqual({
      inline: '',
      full: '',
      fullHtml: '',
    });
  });
});
