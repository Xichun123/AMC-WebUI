import { act } from 'react';
import { setupProviderTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it, vi } from 'vitest';
import { ShortcutRecorder } from './ShortcutRecorder';

describe('ShortcutRecorder', () => {
  const renderer = setupProviderTestRenderer({ providers: { language: 'en' } });

  it('commits the recorded shortcut after the short confirmation delay', () => {
    vi.useFakeTimers();

    try {
      const onChange = vi.fn();

      act(() => {
        renderer.root.render(<ShortcutRecorder value="" defaultValue="" onChange={onChange} />);
      });

      const recordButton = renderer.container.querySelector('button');
      expect(recordButton).not.toBeNull();

      act(() => {
        recordButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true }));
      });

      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(149);
      });

      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(onChange).toHaveBeenCalledWith('k');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the pending commit when the recorder unmounts', () => {
    vi.useFakeTimers();

    try {
      const onChange = vi.fn();

      act(() => {
        renderer.root.render(<ShortcutRecorder value="" defaultValue="" onChange={onChange} />);
      });

      const recordButton = renderer.container.querySelector('button');
      expect(recordButton).not.toBeNull();

      act(() => {
        recordButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true }));
      });

      act(() => {
        renderer.unmount();
        vi.advanceTimersByTime(150);
      });

      expect(onChange).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
