import React from 'react';
import { Type } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import type { AppSettings } from '@/types';
import {
  LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MAX,
  LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MIN,
  clampLiveArtifactsCustomFontSize,
} from '@/utils/liveArtifactsFontSize';

interface LiveArtifactsFontSizeControlProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const LiveArtifactsFontSizeControl: React.FC<LiveArtifactsFontSizeControlProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const customFontSize = clampLiveArtifactsCustomFontSize(settings.liveArtifactsCustomFontSize ?? 16);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor="live-artifacts-custom-font-size"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]"
        >
          <Type size={14} strokeWidth={1.5} />
          {t('settingsLiveArtifactsFontSize')}
        </label>
        <span className="rounded-md bg-[var(--theme-bg-tertiary)] px-2 py-0.5 font-mono text-sm text-[var(--theme-text-link)]">
          {customFontSize}px
        </span>
      </div>
      <input
        id="live-artifacts-custom-font-size"
        type="range"
        min={LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MIN}
        max={LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MAX}
        step="1"
        value={customFontSize}
        onChange={(event) =>
          onUpdate('liveArtifactsCustomFontSize', clampLiveArtifactsCustomFontSize(Number(event.target.value)))
        }
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--theme-border-secondary)] accent-[var(--theme-bg-accent)] hover:accent-[var(--theme-bg-accent-hover)]"
      />
      <div className="flex justify-between px-1 font-mono text-xs text-[var(--theme-text-tertiary)]">
        <span>{LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MIN}px</span>
        <span>16px</span>
        <span>{LIVE_ARTIFACTS_CUSTOM_FONT_SIZE_MAX}px</span>
      </div>
    </div>
  );
};
