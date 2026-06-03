import { useMemo } from 'react';
import { type AppSettings } from '@/types';
import { useChatStore } from '@/stores/chatStore';

export const useChatState = (appSettings: AppSettings) => {
  const activeSessionId = useChatStore((state) => state.activeSessionId);
  const savedSessions = useChatStore((state) => state.savedSessions);
  const activeMessages = useChatStore((state) => state.activeMessages);

  const activeChat = useMemo(() => {
    const metadata = savedSessions.find((session) => session.id === activeSessionId);
    if (metadata) {
      return { ...metadata, messages: activeMessages };
    }
    return undefined;
  }, [savedSessions, activeSessionId, activeMessages]);

  const currentChatSettings = useMemo(() => activeChat?.settings || appSettings, [activeChat, appSettings]);

  const loadingSessionIds = useChatStore((state) => state.loadingSessionIds);
  const isLoading = useMemo(() => loadingSessionIds.has(activeSessionId ?? ''), [loadingSessionIds, activeSessionId]);

  return {
    activeChat,
    currentChatSettings,
    isLoading,

    activeSessionId,
    savedSessions,
    activeMessages,
  };
};
