import { describe, expect, it } from 'vitest';
import { isThirdPartyApiActive } from './thirdPartyApiActive';
import { createAppSettings } from '@/test/data/factories';

describe('isThirdPartyApiActive', () => {
  it('returns true when third-party mode is enabled and active', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: true, apiMode: 'third-party' });
    expect(isThirdPartyApiActive(settings)).toBe(true);
  });

  it('returns false when enabled but apiMode is gemini-native', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: true, apiMode: 'gemini-native' });
    expect(isThirdPartyApiActive(settings)).toBe(false);
  });

  it('returns false when apiMode is third-party but not enabled', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: false, apiMode: 'third-party' });
    expect(isThirdPartyApiActive(settings)).toBe(false);
  });

  it('returns false for legacy openai-compatible apiMode', () => {
    const settings = createAppSettings({ isThirdPartyApiEnabled: true, apiMode: 'openai-compatible' });
    expect(isThirdPartyApiActive(settings)).toBe(false);
  });
});
