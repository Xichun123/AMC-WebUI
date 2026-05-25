import { describe, expect, it } from 'vitest';
import { SETTINGS_INPUT_CLASS } from './formClasses';

describe('SETTINGS_INPUT_CLASS', () => {
  it('keeps shared settings input colors and focus styles centralized', () => {
    expect(SETTINGS_INPUT_CLASS).toContain('bg-[var(--theme-bg-input)]');
    expect(SETTINGS_INPUT_CLASS).toContain('border-[var(--theme-border-secondary)]');
    expect(SETTINGS_INPUT_CLASS).toContain('focus:border-[var(--theme-border-focus)]');
    expect(SETTINGS_INPUT_CLASS).toContain('placeholder-[var(--theme-text-tertiary)]');
  });
});
