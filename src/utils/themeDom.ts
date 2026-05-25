import { AVAILABLE_THEMES } from '@/constants/themeRegistry';
import type { AppSettings } from '@/types';
import type { Theme, ThemeColors } from '@/types/theme';

const generateThemeCssVariables = (colors: ThemeColors): string => {
  let css = ':root {\n';
  for (const [key, value] of Object.entries(colors)) {
    const cssVarName = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    css += `  ${cssVarName}: ${value};\n`;
  }
  css += '}';
  return css;
};

export const applyThemeToDocument = (doc: Document, theme: Theme, settings: AppSettings) => {
  const themeVariablesStyleTag = doc.getElementById('theme-variables');
  if (themeVariablesStyleTag) {
    themeVariablesStyleTag.innerHTML = generateThemeCssVariables(theme.colors);
  }

  const bodyClassList = doc.body.classList;
  AVAILABLE_THEMES.forEach((themeOption) => bodyClassList.remove(`theme-${themeOption.id}`));
  bodyClassList.add(`theme-${theme.id}`, 'antialiased');

  doc.body.style.fontSize = `${settings.baseFontSize}px`;
};
