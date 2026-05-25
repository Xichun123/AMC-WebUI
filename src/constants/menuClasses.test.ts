import { describe, expect, it } from 'vitest';
import {
  MENU_ITEM_BUTTON_CLASS,
  MENU_ITEM_COMPACT_BUTTON_CLASS,
  MENU_ITEM_DEFAULT_STATE_CLASS,
  MENU_ITEM_DANGER_STATE_CLASS,
} from './menuClasses';

describe('menu item helper classes', () => {
  it('keeps shared menu item layout and state styles centralized', () => {
    expect(MENU_ITEM_BUTTON_CLASS).toContain('w-full');
    expect(MENU_ITEM_BUTTON_CLASS).toContain('focus:outline-none');
    expect(MENU_ITEM_COMPACT_BUTTON_CLASS).toContain('text-xs');
    expect(MENU_ITEM_DEFAULT_STATE_CLASS).toContain('focus-visible:bg-[var(--theme-bg-tertiary)]');
    expect(MENU_ITEM_DANGER_STATE_CLASS).toContain('focus-visible:bg-[var(--theme-bg-danger)]');
  });
});
