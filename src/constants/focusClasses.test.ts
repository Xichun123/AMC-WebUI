import { describe, expect, it } from 'vitest';
import {
  FOCUS_VISIBLE_RING_INPUT_OFFSET_CLASS,
  FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS,
  FOCUS_VISIBLE_RING_SECONDARY_OFFSET_CLASS,
} from './focusClasses';

describe('focus ring helper classes', () => {
  it('keeps the shared focus-visible ring definition centralized', () => {
    for (const className of [
      FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS,
      FOCUS_VISIBLE_RING_SECONDARY_OFFSET_CLASS,
      FOCUS_VISIBLE_RING_INPUT_OFFSET_CLASS,
    ]) {
      expect(className).toContain('focus-visible:ring-2');
      expect(className).toContain('focus-visible:ring-[var(--theme-border-focus)]');
      expect(className).toContain('focus-visible:ring-offset-2');
    }
  });

  it('provides per-surface offset helpers', () => {
    expect(FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS).toContain('focus-visible:ring-offset-[var(--theme-bg-primary)]');
    expect(FOCUS_VISIBLE_RING_SECONDARY_OFFSET_CLASS).toContain(
      'focus-visible:ring-offset-[var(--theme-bg-secondary)]',
    );
    expect(FOCUS_VISIBLE_RING_INPUT_OFFSET_CLASS).toContain('focus-visible:ring-offset-[var(--theme-bg-input)]');
  });
});
