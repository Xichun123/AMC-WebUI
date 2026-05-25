import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type translations } from '@/i18n/translations';
import { renderHook } from '@/test/render/renderer';
import { useScenarioManager } from './useScenarioManager';

const createHookProps = () => ({
  isOpen: true,
  savedScenarios: [],
  onSaveAllScenarios: vi.fn(),
  onClose: vi.fn(),
  t: (key: keyof typeof translations, fallback?: string) => fallback ?? key,
});

describe('useScenarioManager', () => {
  it('replaces stale feedback timers instead of stacking them', () => {
    vi.useFakeTimers();

    try {
      const props = createHookProps();
      const { result, unmount } = renderHook(() => useScenarioManager(props));

      act(() => {
        result.current.showFeedback('success', 'First message', 1000);
      });

      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        result.current.showFeedback('error', 'Second message', 2000);
      });

      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1999);
      });

      expect(result.current.feedback?.message).toBe('Second message');

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.feedback).toBeNull();

      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears pending feedback timers when the hook unmounts', () => {
    vi.useFakeTimers();

    try {
      const props = createHookProps();
      const { result, unmount } = renderHook(() => useScenarioManager(props));

      act(() => {
        result.current.showFeedback('info', 'Pending message', 1000);
      });

      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
