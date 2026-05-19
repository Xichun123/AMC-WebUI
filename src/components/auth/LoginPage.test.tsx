import { act } from 'react';
import { fireEvent } from '@testing-library/react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/providerTestUtils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  const renderer = setupTestRenderer();
  const fetchMock = vi.fn();
  const originalLocation = window.location;
  const assignMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false }),
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: '/login',
        search: '?next=/chat/session-1',
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

  it('renders only the compact credential controls', async () => {
    await act(async () => {
      renderer.root.render(<LoginPage />);
    });

    expect(renderer.container.querySelector('img[alt="AMC WebUI"]')?.getAttribute('src')).toBe('/sidebar-logo.png');
    expect(renderer.container.querySelector('input[placeholder="用户名"]')).not.toBeNull();
    expect(renderer.container.querySelector('input[placeholder="密码"]')).not.toBeNull();
    expect(renderer.container.querySelector('button')?.textContent).toBe('登录');
    expect(renderer.container.textContent).not.toContain('GitHub');
    expect(renderer.container.textContent).not.toContain('AMC WebUI');
  });

  it('posts Unicode credentials and redirects to the safe next path after login', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: true, username: '慧慧' }),
      });

    await act(async () => {
      renderer.root.render(<LoginPage />);
    });

    const [usernameInput, passwordInput] = Array.from(renderer.container.querySelectorAll('input'));
    const form = renderer.container.querySelector('form');

    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: '慧慧' } });
      fireEvent.change(passwordInput, { target: { value: '棒棒棒' } });
    });

    await act(async () => {
      fireEvent.submit(form!);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/login',
      expect.objectContaining({
        body: JSON.stringify({ username: '慧慧', password: '棒棒棒' }),
      }),
    );
    expect(assignMock).toHaveBeenCalledWith('/chat/session-1');
  });
});
