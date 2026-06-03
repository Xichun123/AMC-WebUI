import type { MutableRefObject } from 'react';
import { useChatStore } from '@/stores/chatStore';
import type { SessionsUpdater } from './messageSenderTypes';

interface SenderStoreActions {
  updateAndPersistSessions: SessionsUpdater;
  setActiveSessionId: (id: string | null) => void;
  setSessionLoading: (sessionId: string, isLoading: boolean) => void;
  activeJobs: MutableRefObject<Map<string, AbortController>>;
}

export const createSenderStoreActions = (): SenderStoreActions => {
  const getStore = () => useChatStore.getState();

  return {
    updateAndPersistSessions: (updater, options) => getStore().updateAndPersistSessions(updater, options),
    setActiveSessionId: (id) => getStore().setActiveSessionId(id),
    setSessionLoading: (sessionId, isLoading) => getStore().setSessionLoading(sessionId, isLoading),
    activeJobs: getStore()._activeJobs,
  };
};
