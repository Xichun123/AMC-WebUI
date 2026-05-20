import { type AppSettings } from '@/types';
import { DEFAULT_SHORTCUTS } from '@/constants/shortcuts';

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const KEY_DISPLAY_MAP: Record<string, string> = {
  mod: isMac ? '⌘' : 'Ctrl',
  alt: isMac ? 'Opt' : 'Alt',
  shift: 'Shift',
  ctrl: 'Ctrl',
  meta: isMac ? 'Cmd' : 'Win',
  enter: 'Enter',
  escape: 'Esc',
  delete: 'Del',
  backspace: 'Back',
  tab: 'Tab',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
};

export const formatShortcut = (shortcut: string): string[] => {
  if (!shortcut) return [];

  const parts = shortcut.split('+');
  return parts.map((part) => {
    const lower = part.trim().toLowerCase();
    return KEY_DISPLAY_MAP[lower] ?? part.toUpperCase();
  });
};

const getEventKeyCombo = (e: React.KeyboardEvent | KeyboardEvent): string | null => {
  // Ignore modifier-only presses for combo detection (unless that's what we want? usually not)
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;

  const parts: string[] = [];

  if (e.ctrlKey) parts.push('ctrl');
  if (e.metaKey) parts.push('meta');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');

  let key = e.key;
  if (key === ' ') key = 'space';
  if (key === 'ArrowUp') key = 'arrowup';
  if (key === 'ArrowDown') key = 'arrowdown';
  if (key === 'ArrowLeft') key = 'arrowleft';
  if (key === 'ArrowRight') key = 'arrowright';
  if (key === 'Enter') key = 'enter';
  if (key === 'Escape') key = 'escape';
  if (key === 'Tab') key = 'tab';
  if (key === 'Delete') key = 'delete';
  if (key === 'Backspace') key = 'backspace';

  key = key.toLowerCase();

  parts.push(key);

  const uniqueParts = [...new Set(parts)];

  // Sort modifiers: meta, ctrl, alt, shift
  const order = ['meta', 'ctrl', 'alt', 'shift'];
  const modifiers = uniqueParts.slice(0, -1).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const finalKey = uniqueParts[uniqueParts.length - 1];

  let resultParts = [...modifiers, finalKey];

  // Normalize to 'mod' concept for cross-platform defaults
  if (isMac) {
    if (resultParts.includes('meta')) {
      resultParts = resultParts.map((p) => (p === 'meta' ? 'mod' : p));
    }
  } else {
    if (resultParts.includes('ctrl')) {
      resultParts = resultParts.map((p) => (p === 'ctrl' ? 'mod' : p));
    }
  }

  return resultParts.join('+');
};

export const recordKeyCombination = (e: React.KeyboardEvent | KeyboardEvent): string | null => {
  e.preventDefault();
  e.stopPropagation();
  return getEventKeyCombo(e);
};

export const isShortcutPressed = (
  e: React.KeyboardEvent | KeyboardEvent,
  actionId: string,
  settings: AppSettings,
): boolean => {
  const customKey = settings.customShortcuts?.[actionId];
  const defaultKey = DEFAULT_SHORTCUTS[actionId];
  const targetKey = customKey !== undefined ? customKey : defaultKey;

  if (!targetKey) return false;

  const pressedKey = getEventKeyCombo(e);
  return pressedKey === targetKey;
};

export const getShortcutDisplay = (actionId: string, settings: AppSettings): string => {
  const customKey = settings.customShortcuts?.[actionId];
  const key = customKey !== undefined ? customKey : DEFAULT_SHORTCUTS[actionId];
  if (!key) return '';
  return formatShortcut(key).join(' + ');
};
