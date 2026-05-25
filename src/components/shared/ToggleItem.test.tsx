import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it, vi } from 'vitest';
import { ToggleItem } from './ToggleItem';

describe('ToggleItem', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });

  it('toggles from the row with keyboard activation', () => {
    const onChange = vi.fn();

    act(() => {
      renderer.root.render(<ToggleItem label="Show thoughts" checked={false} onChange={onChange} />);
    });

    const row = renderer.container.querySelector<HTMLElement>('[role="switch"]');
    expect(row).not.toBeNull();
    expect(row?.getAttribute('tabindex')).toBe('0');
    expect(row?.getAttribute('aria-checked')).toBe('false');

    act(() => {
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
