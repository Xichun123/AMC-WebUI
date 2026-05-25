import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import { useUIStore } from '@/stores/uiStore';
import type { ChatRuntimeValues } from './chatRuntimeTypes';
import { useChatHeaderRuntimeValues } from './headerRuntimeValues';
import { useChatInputRuntimeValues } from './inputRuntimeValues';
import { useChatMessageListRuntimeValues } from './messageListRuntimeValues';

export const useChatRuntimeValues = (app: AppViewModel): ChatRuntimeValues => {
  const { setIsHistorySidebarOpen } = app.uiState;
  const setIsSettingsModalOpen = useUIStore((state) => state.setIsSettingsModalOpen);
  const setIsPreloadedMessagesModalOpen = useUIStore((state) => state.setIsPreloadedMessagesModalOpen);

  const openSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, [setIsSettingsModalOpen]);

  const openScenariosModal = useCallback(() => {
    setIsPreloadedMessagesModalOpen(true);
  }, [setIsPreloadedMessagesModalOpen]);

  const toggleHistorySidebar = useCallback(() => {
    setIsHistorySidebarOpen((prev) => !prev);
  }, [setIsHistorySidebarOpen]);

  const { header, headerAvailableModels, handleHeaderSelectModel } = useChatHeaderRuntimeValues({
    app,
    onOpenScenariosModal: openScenariosModal,
    onToggleHistorySidebar: toggleHistorySidebar,
  });
  const messageList = useChatMessageListRuntimeValues({ app });
  const input = useChatInputRuntimeValues({
    app,
    availableModels: headerAvailableModels,
    onOpenSettings: openSettingsModal,
    onSelectModel: handleHeaderSelectModel,
  });

  return useMemo(
    () => ({
      header,
      messageList,
      input,
    }),
    [header, input, messageList],
  );
};
