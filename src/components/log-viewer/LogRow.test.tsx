import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@/types/logging';
import { LogRow } from './LogRow';

describe('LogRow', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });

  it('expands structured log data from keyboard activation', () => {
    const log: LogEntry = {
      timestamp: new Date('2026-05-22T00:00:00.000Z'),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'loaded config',
      data: { mode: 'test' },
    };

    act(() => {
      renderer.root.render(<LogRow log={log} />);
    });

    const rowButton = renderer.container.querySelector<HTMLElement>('[role="button"]');
    expect(rowButton).not.toBeNull();
    expect(rowButton?.getAttribute('tabindex')).toBe('0');
    expect(rowButton?.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      rowButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(rowButton?.getAttribute('aria-expanded')).toBe('true');
    expect(renderer.container.textContent).toContain('"mode": "test"');
  });
});
