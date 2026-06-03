import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it, vi } from 'vitest';
import { FOCUS_HISTORY_SEARCH_EVENT } from '@/constants/shortcuts';
import { createHistorySidebarProps } from '@/test/sidebar/historySidebar';
import { HistorySidebar } from './HistorySidebar';

vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [vi.fn()],
}));

describe('HistorySidebar search shortcut', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });

  const renderSidebar = async (overrides: Parameters<typeof createHistorySidebarProps>[0] = {}) => {
    await act(async () => {
      renderer.root.render(<HistorySidebar {...createHistorySidebarProps({ isOpen: false, ...overrides })} />);
    });
  };

  it('opens and focuses chat search when the global focus event is dispatched', async () => {
    const onToggle = vi.fn();

    await renderSidebar({ onToggle, searchChatsShortcut: 'Ctrl + K' });

    await act(async () => {
      document.dispatchEvent(new Event(FOCUS_HISTORY_SEARCH_EVENT));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
    const searchInput = renderer.container.querySelector<HTMLInputElement>('input[aria-label="Search chat history"]');
    expect(searchInput).not.toBeNull();
    expect(document.activeElement).toBe(searchInput);
  });

  it('shows the chat search shortcut in the collapsed search tooltip', async () => {
    await renderSidebar({ searchChatsShortcut: 'Ctrl + K' });

    const searchButton = renderer.container.querySelector<HTMLButtonElement>('button[aria-label="Search (Ctrl + K)"]');
    expect(searchButton).not.toBeNull();
    expect(searchButton?.getAttribute('title')).toBe('Search (Ctrl + K)');
  });

  it('keeps the collapsed sidebar toggle aligned with the expanded header toggle', async () => {
    await renderSidebar();

    const openToggles = renderer.container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Open history sidebar"]',
    );
    const collapsedToggle = openToggles[openToggles.length - 1];

    expect(collapsedToggle?.className).toContain('-translate-y-1');
  });

  it('marks the hidden expanded sidebar pane inert when collapsed', async () => {
    await renderSidebar();

    const hiddenExpandedPane = renderer.container.querySelector<HTMLElement>(
      '[data-history-sidebar-expanded-pane="true"][aria-hidden="true"]',
    );

    expect(hiddenExpandedPane).not.toBeNull();
    expect(hiddenExpandedPane).toHaveAttribute('inert');
  });
});
