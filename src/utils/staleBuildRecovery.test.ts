import { describe, expect, it, vi } from 'vitest';
import { isStaleBuildError, recoverFromStaleBuild, type StaleBuildRecoveryTarget } from './staleBuildRecovery';

describe('stale build recovery', () => {
  it('detects dynamic import failures from stale hashed chunks', () => {
    expect(
      isStaleBuildError(
        new Error(
          'Failed to fetch dynamically imported module: http://localhost:8082/assets/HistorySidebar-RPZ9ouvU.js',
        ),
      ),
    ).toBe(true);
    expect(isStaleBuildError(new Error('Regular render failure'))).toBe(false);
  });

  it('clears service workers and caches before reloading the app', async () => {
    const unregister = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    const reload = vi.fn();
    const target: StaleBuildRecoveryTarget = {
      navigator: {
        serviceWorker: {
          getRegistrations: vi.fn(async () => [{ unregister }]),
        },
      },
      caches: {
        keys: vi.fn(async () => ['app-shell', 'static-assets']),
        delete: deleteCache,
      },
      location: { reload },
    };

    await recoverFromStaleBuild(target);

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('app-shell');
    expect(deleteCache).toHaveBeenCalledWith('static-assets');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
