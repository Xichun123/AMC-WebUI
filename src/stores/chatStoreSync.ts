import type { SavedChatSession } from '@/types';
import type { SyncMessage } from '@/types/sync';
import { logService } from '@/services/logService';
import { dbService } from '@/services/db/dbService';
import { rehydrateSessionFiles } from '@/utils/chat/session';
import { getChatSyncChannel } from './chatSyncChannel';
import type { UpdaterOrValue } from './stateUpdaters';

interface ChatSyncStore {
  getState: () => {
    activeSessionId: string | null;
    refreshSessions: () => Promise<void>;
    refreshGroups: () => Promise<void>;
    setActiveMessages: (messages: SavedChatSession['messages']) => void;
    setSavedSessions: (updater: UpdaterOrValue<SavedChatSession[]>) => void;
    setLoadingSessionIds: (updater: UpdaterOrValue<Set<string>>) => void;
  };
}

interface ChatStoreSyncDependencies {
  store: ChatSyncStore;
  localLoadingSessionIds: Set<string>;
  getChannel?: () => BroadcastChannel;
  getSession?: (sessionId: string) => Promise<SavedChatSession | null | undefined>;
  rehydrateSession?: (session: SavedChatSession) => SavedChatSession;
  logger?: Pick<typeof logService, 'info'>;
  documentRef?: Document;
}

export function setupChatStoreSync({
  store,
  localLoadingSessionIds,
  getChannel = getChatSyncChannel,
  getSession = dbService.getSession.bind(dbService),
  rehydrateSession = rehydrateSessionFiles,
  logger = logService,
  documentRef,
}: ChatStoreSyncDependencies) {
  const resolvedDocument = documentRef ?? (typeof document !== 'undefined' ? document : undefined);

  if (typeof BroadcastChannel === 'undefined' || !resolvedDocument) {
    return () => {};
  }

  let isDirty = false;
  const channel = getChannel();

  const handleMessage = (event: MessageEvent<SyncMessage>) => {
    const syncMessage = event.data;

    switch (syncMessage.type) {
      case 'SETTINGS_UPDATED':
      case 'SESSIONS_UPDATED':
        if (resolvedDocument.hidden) {
          isDirty = true;
        } else {
          store.getState().refreshSessions();
        }
        break;
      case 'GROUPS_UPDATED':
        if (resolvedDocument.hidden) {
          isDirty = true;
        } else {
          store.getState().refreshGroups();
        }
        break;
      case 'SESSION_CONTENT_UPDATED': {
        if (localLoadingSessionIds.has(syncMessage.sessionId)) return;
        if (resolvedDocument.hidden) {
          isDirty = true;
          return;
        }

        const { activeSessionId } = store.getState();
        if (syncMessage.sessionId === activeSessionId) {
          getSession(syncMessage.sessionId).then((session) => {
            if (session) {
              const rehydrated = rehydrateSession(session);
              store.getState().setActiveMessages(rehydrated.messages);
              store
                .getState()
                .setSavedSessions((previousSessions) =>
                  previousSessions.map((savedSession) =>
                    savedSession.id === syncMessage.sessionId ? { ...rehydrated, messages: [] } : savedSession,
                  ),
                );
            }
          });
        } else {
          store.getState().refreshSessions();
        }
        break;
      }
      case 'SESSION_LOADING': {
        store.getState().setLoadingSessionIds((previousLoadingSessionIds) => {
          const nextLoadingSessionIds = new Set(previousLoadingSessionIds);
          if (syncMessage.isLoading) nextLoadingSessionIds.add(syncMessage.sessionId);
          else nextLoadingSessionIds.delete(syncMessage.sessionId);
          return nextLoadingSessionIds;
        });
        break;
      }
    }
  };

  const handleVisibilityChange = () => {
    if (resolvedDocument.visibilityState === 'visible' && isDirty) {
      logger.info('[Sync] Tab visible, syncing pending updates from DB.');
      store.getState().refreshSessions();
      store.getState().refreshGroups();
      isDirty = false;
    }
  };

  channel.addEventListener('message', handleMessage);
  resolvedDocument.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    channel.removeEventListener('message', handleMessage);
    resolvedDocument.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
