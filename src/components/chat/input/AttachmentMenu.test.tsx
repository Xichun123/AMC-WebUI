import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { describe, expect, it, vi } from 'vitest';
import { setupStoreStateReset } from '@/test/stores/reset';
import { createChatInputActionsContextValue } from '@/test/chat-input/contextFixtures';
import { ChatInputActionsContext } from './ChatInputContext';

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createLogServiceMockModule();
});

vi.mock('@/hooks/ui/usePortaledMenu', () => ({
  usePortaledMenu: () => ({
    isOpen: true,
    menuPosition: {},
    containerRef: { current: null },
    buttonRef: { current: null },
    menuRef: { current: null },
    targetWindow: window,
    closeMenu: vi.fn(),
    toggleMenu: vi.fn(),
  }),
}));

import { AttachmentMenu } from './AttachmentMenu';

describe('AttachmentMenu', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });
  setupStoreStateReset();

  it('shows YouTube video attachment action when YouTube URLs are supported', () => {
    const onAction = vi.fn();

    act(() => {
      renderer.root.render(
        <ChatInputActionsContext.Provider
          value={createChatInputActionsContextValue({ onAttachmentAction: onAction, canAddYouTubeVideo: true })}
        >
          <AttachmentMenu />
        </ChatInputActionsContext.Provider>,
      );
    });

    const youtubeButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Add YouTube Video'),
    );

    expect(youtubeButton).not.toBeUndefined();

    act(() => {
      youtubeButton?.click();
    });

    expect(onAction).toHaveBeenCalledWith('url');
  });

  it('shows only image-relevant actions for Gemini image models', () => {
    act(() => {
      renderer.root.render(
        <ChatInputActionsContext.Provider value={createChatInputActionsContextValue({ isImageGenerationModel: true })}>
          <AttachmentMenu />
        </ChatInputActionsContext.Provider>,
      );
    });

    expect(document.body.textContent).toContain('Upload from Device');
    expect(document.body.textContent).toContain('Gallery');
    expect(document.body.textContent).toContain('Take Photo');
    expect(document.body.textContent).toContain('Screenshot');
    expect(document.body.textContent).toContain('Add by File ID');

    expect(document.body.textContent).not.toContain('Import Folder (as Text)');
    expect(document.body.textContent).not.toContain('Import Zip (as Text)');
    expect(document.body.textContent).not.toContain('Record Audio');
    expect(document.body.textContent).not.toContain('Create Text File');
    expect(document.body.textContent).not.toContain('Add YouTube Video');
  });
});
