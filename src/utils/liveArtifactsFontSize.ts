import type { AppSettings } from '@/types';

export const LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MIN = 10;
export const LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MAX = 32;

export const clampLiveArtifactsCustomFontSize = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 16;
  }

  return Math.min(
    LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MAX,
    Math.max(LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MIN, Math.round(value)),
  );
};

export const resolveLiveArtifactsFontSize = (settings: Pick<AppSettings, 'liveArtifactsCustomFontSize'>): number => {
  return clampLiveArtifactsCustomFontSize(settings.liveArtifactsCustomFontSize ?? 16);
};
