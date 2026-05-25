import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteSessionGate } from './SiteSessionGate';

describe('SiteSessionGate', () => {
  const renderer = setupTestRenderer();
  const fetchMock = vi.fn();
  const originalLocation = window.location;
  const assignMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/chat/session-1',
        search: '?view=latest',
        hash: '#message-2',
        assign: assignMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    fetchMock.mockReset();
    assignMock.mockReset();
  });

  it('renders children after the session endpoint confirms access', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true }),
    });

    await act(async () => {
      renderer.root.render(
        <SiteSessionGate>
          <div data-testid="protected-content" />
        </SiteSessionGate>,
      );
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    expect(renderer.container.querySelector('[data-testid="protected-content"]')).not.toBeNull();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('redirects to login with the current path when the session is not authenticated', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false }),
    });

    await act(async () => {
      renderer.root.render(
        <SiteSessionGate>
          <div data-testid="protected-content" />
        </SiteSessionGate>,
      );
    });

    expect(renderer.container.querySelector('[data-testid="protected-content"]')).toBeNull();
    expect(assignMock).toHaveBeenCalledWith('/login?next=%2Fchat%2Fsession-1%3Fview%3Dlatest%23message-2');
  });
});
