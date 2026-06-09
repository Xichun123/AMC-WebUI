import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@/constants/settingsDefaults';
import { isDarkThemeId, isKnownThemeId, normalizeThemeId } from './themeMode';

describe('themeMode', () => {
  it('treats graphite as a known dark theme', () => {
    expect(isKnownThemeId('graphite')).toBe(true);
    expect(isDarkThemeId('graphite')).toBe(true);
  });

  it('keeps pearl as the only light concrete theme', () => {
    expect(isDarkThemeId('onyx')).toBe(true);
    expect(isDarkThemeId('pearl')).toBe(false);
  });

  it('falls back to the default theme for unknown ids', () => {
    expect(normalizeThemeId('unknown-theme')).toBe(DEFAULT_APP_SETTINGS.themeId);
  });
});
