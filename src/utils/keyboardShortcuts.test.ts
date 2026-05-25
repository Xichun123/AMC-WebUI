import { describe, expect, it } from 'vitest';
import { formatShortcut } from './keyboardShortcuts';

describe('formatShortcut', () => {
  it('formats recorded space key names for display', () => {
    expect(formatShortcut('space')).toEqual(['Space']);
  });
});
