import { describe, expect, it } from 'vitest';
import { AVAILABLE_THEMES } from './themeRegistry';

const hexToRgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const expectNeutralGray = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex);
  expect(Math.max(red, green, blue) - Math.min(red, green, blue)).toBeLessThanOrEqual(2);
};

describe('themeRegistry', () => {
  it('registers the graphite theme between dark and light', () => {
    expect(AVAILABLE_THEMES.map((theme) => theme.id)).toEqual(['onyx', 'graphite', 'pearl']);

    const graphite = AVAILABLE_THEMES.find((theme) => theme.id === 'graphite');

    expect(graphite?.name).toBe('Graphite (Gray)');
    expect(graphite?.colors.bgPrimary).toBe('#2f2f2f');
    expect(graphite?.colors.bgSecondary).toBe('#242424');
    expect(graphite?.colors.textPrimary).toBe('#f3f3f3');
  });

  it('keeps graphite core surfaces neutral gray instead of blue gray', () => {
    const graphite = AVAILABLE_THEMES.find((theme) => theme.id === 'graphite');

    expect(graphite).toBeDefined();

    [
      graphite!.colors.bgPrimary,
      graphite!.colors.bgSecondary,
      graphite!.colors.bgTertiary,
      graphite!.colors.bgAccent,
      graphite!.colors.bgAccentHover,
      graphite!.colors.bgInput,
      graphite!.colors.bgUserMessage,
      graphite!.colors.borderPrimary,
      graphite!.colors.borderSecondary,
      graphite!.colors.borderFocus,
      graphite!.colors.textSecondary,
      graphite!.colors.textTertiary,
      graphite!.colors.textLink,
    ].forEach(expectNeutralGray);
  });
});
