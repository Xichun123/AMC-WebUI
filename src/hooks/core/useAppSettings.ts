import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { applyThemeToDocument } from '@/utils/themeDom';

export const useAppSettings = () => {
  const appSettings = useSettingsStore((state) => state.appSettings);
  const setAppSettings = useSettingsStore((state) => state.setAppSettings);
  const currentTheme = useSettingsStore((state) => state.currentTheme);
  const language = useSettingsStore((state) => state.language);
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    applyThemeToDocument(document, currentTheme, appSettings);
  }, [appSettings, currentTheme]);

  return { appSettings, setAppSettings, currentTheme, language };
};
