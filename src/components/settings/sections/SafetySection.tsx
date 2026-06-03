import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { type SafetySetting, HarmCategory, HarmBlockThreshold } from '@/types';
import { Shield, Info } from 'lucide-react';
import { DEFAULT_SAFETY_SETTINGS } from '@/constants/safetySettings';

interface SafetySectionProps {
  safetySettings: SafetySetting[] | undefined;
  setSafetySettings: (settings: SafetySetting[]) => void;
  showIntro?: boolean;
}

const ALL_CATEGORIES: HarmCategory[] = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
];

const CATEGORY_TRANSLATION_KEYS: Record<HarmCategory, string> = {
  [HarmCategory.HARM_CATEGORY_HARASSMENT]: 'safety_category_HARASSMENT',
  [HarmCategory.HARM_CATEGORY_HATE_SPEECH]: 'safety_category_HATE_SPEECH',
  [HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: 'safety_category_SEXUALLY_EXPLICIT',
  [HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: 'safety_category_DANGEROUS_CONTENT',
  [HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY]: 'safety_category_CIVIC_INTEGRITY',
};

const DEFAULT_THRESHOLD_INDEX = 3;
const THRESHOLD_STEPS: HarmBlockThreshold[] = [
  HarmBlockThreshold.OFF,
  HarmBlockThreshold.BLOCK_NONE,
  HarmBlockThreshold.BLOCK_ONLY_HIGH,
  HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
];

const THRESHOLD_LABEL_KEYS: Record<HarmBlockThreshold, string> = {
  [HarmBlockThreshold.OFF]: 'safety_threshold_OFF',
  [HarmBlockThreshold.BLOCK_NONE]: 'safety_threshold_BLOCK_NONE',
  [HarmBlockThreshold.BLOCK_ONLY_HIGH]: 'safety_threshold_BLOCK_ONLY_HIGH',
  [HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE]: 'safety_threshold_BLOCK_MEDIUM_AND_ABOVE',
  [HarmBlockThreshold.BLOCK_LOW_AND_ABOVE]: 'safety_threshold_BLOCK_LOW_AND_ABOVE',
};

const STEP_TEXT_COLOR_CLASSES = [
  'text-red-500',
  'text-orange-500',
  'text-yellow-500',
  'text-blue-500',
  'text-green-500',
];

type SliderValueMap = Record<HarmCategory, number>;

const clampIndex = (index: number) => {
  if (Number.isNaN(index)) return DEFAULT_THRESHOLD_INDEX;
  return Math.min(THRESHOLD_STEPS.length - 1, Math.max(0, index));
};

const indexFromThreshold = (threshold: HarmBlockThreshold | undefined) => {
  const thresholdIndex = threshold ? THRESHOLD_STEPS.indexOf(threshold) : -1;
  return clampIndex(thresholdIndex !== -1 ? thresholdIndex : DEFAULT_THRESHOLD_INDEX);
};

const normalizeSettings = (settings: SafetySetting[] | undefined): SafetySetting[] => {
  const merged = new Map<HarmCategory, HarmBlockThreshold>();

  for (const setting of DEFAULT_SAFETY_SETTINGS) merged.set(setting.category, setting.threshold);

  if (settings && settings.length > 0) {
    for (const setting of settings) merged.set(setting.category, setting.threshold);
  }

  return ALL_CATEGORIES.map((category) => ({
    category,
    threshold: merged.get(category) ?? HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  }));
};

const buildSliderMap = (settings: SafetySetting[] | undefined): SliderValueMap => {
  const normalized = normalizeSettings(settings);
  const map = {} as SliderValueMap;
  for (const setting of normalized) {
    map[setting.category] = indexFromThreshold(setting.threshold);
  }
  return map;
};

export const SafetySection: React.FC<SafetySectionProps> = ({
  safetySettings,
  setSafetySettings,
  showIntro = true,
}) => {
  const { t } = useI18n();
  const normalizedSettings = useMemo(() => normalizeSettings(safetySettings), [safetySettings]);

  const [sliderValues, setSliderValues] = useState<SliderValueMap>(() => buildSliderMap(safetySettings));

  useEffect(() => {
    setSliderValues(buildSliderMap(safetySettings));
  }, [safetySettings]);

  const handleSliderChange = useCallback(
    (category: HarmCategory, valueIndex: number) => {
      const nextIndex = clampIndex(valueIndex);

      setSliderValues((prev) => {
        const nextSliderValues = { ...prev, [category]: nextIndex };

        const updatedSettings = ALL_CATEGORIES.map((currentCategory) => ({
          category: currentCategory,
          threshold:
            THRESHOLD_STEPS[nextSliderValues[currentCategory] ?? DEFAULT_THRESHOLD_INDEX] ??
            HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }));

        setSafetySettings(updatedSettings);

        return nextSliderValues;
      });
    },
    [setSafetySettings],
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {showIntro && (
        <div className="flex items-start gap-3 p-4 bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)] rounded-xl">
          <Shield size={24} className="text-[var(--theme-text-link)] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-[var(--theme-text-primary)]">{t('safety_title')}</h3>
            <p className="text-sm text-[var(--theme-text-secondary)] mt-1 leading-relaxed opacity-90">
              {t('safety_description')}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {normalizedSettings.map((setting) => {
          const category = setting.category;
          const sliderValue = sliderValues[category] ?? indexFromThreshold(setting.threshold);
          const effectiveThreshold = THRESHOLD_STEPS[sliderValue] ?? HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;

          return (
            <div
              key={category}
              className="space-y-3 pb-4 border-b border-[var(--theme-border-secondary)]/50 last:border-0"
            >
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-[var(--theme-text-primary)]">
                  {t(CATEGORY_TRANSLATION_KEYS[category])}
                </label>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    STEP_TEXT_COLOR_CLASSES[sliderValue] || 'text-[var(--theme-text-primary)]'
                  }`}
                >
                  {t(THRESHOLD_LABEL_KEYS[effectiveThreshold])}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={sliderValue}
                onChange={(e) => handleSliderChange(category, parseInt(e.target.value, 10))}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                style={{ touchAction: 'none' }}
                className="w-full h-2 bg-[var(--theme-bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-bg-accent)] hover:accent-[var(--theme-bg-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]"
              />

              <div className="flex justify-between px-1">
                {THRESHOLD_STEPS.map((step, stepIndex) => (
                  <div key={step} className="flex flex-col items-center w-8">
                    <div
                      className={`w-1 h-2 rounded-full mb-1 ${
                        stepIndex === sliderValue
                          ? 'bg-[var(--theme-text-primary)] h-3'
                          : 'bg-[var(--theme-border-secondary)]'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-[var(--theme-text-tertiary)] pt-4">
        <Info size={14} />
        <span>{t('safety_changes_apply')}</span>
      </div>
    </div>
  );
};
