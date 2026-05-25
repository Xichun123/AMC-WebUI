import {
  FOCUS_VISIBLE_RING_INPUT_OFFSET_CLASS,
  FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS,
  FOCUS_VISIBLE_RING_SECONDARY_OFFSET_CLASS,
} from './focusClasses';

export const MESSAGE_BLOCK_BUTTON_CLASS =
  'min-h-11 min-w-11 p-1.5 rounded-md inline-flex items-center justify-center text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)]/50 transition-all duration-200 focus:outline-none opacity-70 hover:opacity-100';
export const CHAT_INPUT_BUTTON_CLASS = `h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_VISIBLE_RING_INPUT_OFFSET_CLASS} p-0 m-0 border-0 leading-none`;
export const ICON_BUTTON_CLASS =
  'p-2 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] rounded-lg transition-colors';
export const MODAL_CLOSE_BUTTON_CLASS = `p-1.5 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] rounded-full transition-colors ${FOCUS_VISIBLE_RING_SECONDARY_OFFSET_CLASS}`;
export const MODAL_CLOSE_BUTTON_DANGER_HOVER_CLASS = `p-2 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-danger)] hover:bg-[var(--theme-bg-danger)]/10 rounded-lg transition-colors ${FOCUS_VISIBLE_RING_SECONDARY_OFFSET_CLASS}`;
export const SMALL_ICON_BUTTON_CLASS = `p-1.5 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] rounded-md transition-colors ${FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS}`;
export const SMALL_ICON_BUTTON_ROUND_CLASS = `p-1.5 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] rounded-full transition-colors ${FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS}`;
export const SMALL_ICON_DANGER_BUTTON_CLASS = `p-1.5 text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-danger)] hover:bg-[var(--theme-bg-danger)]/10 rounded-md transition-colors ${FOCUS_VISIBLE_RING_PRIMARY_OFFSET_CLASS}`;
