import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it, vi } from 'vitest';
import { ApiConfigToggle } from './ApiConfigToggle';

describe('ApiConfigToggle', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });

  it('exposes the row as a keyboard-operable switch', () => {
    const setUseCustomApiConfig = vi.fn();

    act(() => {
      renderer.root.render(
        <ApiConfigToggle useCustomApiConfig={false} setUseCustomApiConfig={setUseCustomApiConfig} hasEnvKey={true} />,
      );
    });

    const row = renderer.container.querySelector<HTMLElement>('[role="switch"]');
    expect(row).not.toBeNull();
    expect(row?.getAttribute('tabindex')).toBe('0');
    expect(row?.getAttribute('aria-checked')).toBe('false');

    act(() => {
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(setUseCustomApiConfig).toHaveBeenCalledWith(true);
  });
});
