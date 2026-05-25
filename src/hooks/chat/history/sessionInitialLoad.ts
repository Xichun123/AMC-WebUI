import type { Dispatch, SetStateAction } from 'react';

import { ACTIVE_CHAT_SESSION_ID_KEY } from '@/constants/storageKeys';
import { dbService } from '@/services/db/dbService';
import { logService } from '@/services/logService';
import type { SetActiveSessionOptions } from '@/stores/chatStore';
import type { ChatGroup, ChatMessage, SavedChatSession } from '@/types';
import { rehydrateSessionFiles } from '@/utils/chat/session';
import { sanitizeSessionModel, sortSessionsByPinnedAndTimestamp } from './sessionLoaderSettings';

type SessionLoaderHistoryOptions = Pick<SetActiveSessionOptions, 'history'>;

interface LoadInitialSessionDataOptions {
  setSavedSessions: Dispatch<SetStateAction<SavedChatSession[]>>;
  setSavedGroups: Dispatch<SetStateAction<ChatGroup[]>>;
  setActiveSessionId: (value: SetStateAction<string | null>, options?: SetActiveSessionOptions) => void;
  setActiveMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  restoreDraftFiles: (sessionId: string) => void;
  startNewChat: (explicitTemplateSession?: SavedChatSession, options?: SessionLoaderHistoryOptions) => void;
}

const resolveInitialActiveSessionId = (metadataList: SavedChatSession[]) => {
  const urlMatch = window.location.pathname.match(/^\/chat\/([^/]+)$/);
  const urlSessionId = urlMatch ? urlMatch[1] : null;

  if (urlSessionId && metadataList.some((session) => session.id === urlSessionId)) {
    return urlSessionId;
  }

  const storedActiveId = sessionStorage.getItem(ACTIVE_CHAT_SESSION_ID_KEY);
  if (storedActiveId && metadataList.some((session) => session.id === storedActiveId)) {
    return storedActiveId;
  }

  return null;
};

const mergeLoadedSessionMetadata = (
  currentSessions: SavedChatSession[],
  sortedMetadata: SavedChatSession[],
): SavedChatSession[] => {
  if (currentSessions.length === 0) {
    return sortedMetadata;
  }

  const currentById = new Map(currentSessions.map((session) => [session.id, session]));
  const merged = sortedMetadata.map((session) => {
    const existing = currentById.get(session.id);

    if (!existing) {
      return session;
    }

    currentById.delete(session.id);
    return {
      ...session,
      ...existing,
      settings: {
        ...session.settings,
        ...existing.settings,
      },
      messages: existing.messages ?? session.messages,
    };
  });

  return sortSessionsByPinnedAndTimestamp([...merged, ...currentById.values()]);
};

export const loadInitialSessionData = async ({
  setSavedSessions,
  setSavedGroups,
  setActiveSessionId,
  setActiveMessages,
  restoreDraftFiles,
  startNewChat,
}: LoadInitialSessionDataOptions) => {
  try {
    logService.info('Attempting to load chat history metadata from IndexedDB.');

    const [metadataList, groups] = await Promise.all([dbService.getAllSessionMetadata(), dbService.getAllGroups()]);

    let initialActiveId = resolveInitialActiveSessionId(metadataList);

    if (initialActiveId) {
      const fullActiveSession = await dbService.getSession(initialActiveId);
      if (fullActiveSession) {
        logService.info(`Loaded full content for active session: ${initialActiveId}`);
        const rehydrated = rehydrateSessionFiles(sanitizeSessionModel(fullActiveSession));
        setActiveMessages(rehydrated.messages);
        setActiveSessionId(initialActiveId, { history: 'replace' });
        restoreDraftFiles(initialActiveId);
      } else {
        initialActiveId = null;
      }
    }

    const sortedList = sortSessionsByPinnedAndTimestamp(metadataList.map(sanitizeSessionModel));

    setSavedSessions((prev) => mergeLoadedSessionMetadata(prev, sortedList));
    setSavedGroups(groups.map((group) => ({ ...group, isExpanded: group.isExpanded ?? true })));

    if (!initialActiveId) {
      const mostRecent = sortedList[0];
      let reused = false;

      if (mostRecent) {
        const fullSession = await dbService.getSession(mostRecent.id);
        if (fullSession && fullSession.messages.length === 0 && !fullSession.settings.systemInstruction) {
          logService.info(`Reusing empty recent session: ${mostRecent.id}`);
          const rehydrated = rehydrateSessionFiles(sanitizeSessionModel(fullSession));
          setActiveMessages(rehydrated.messages);
          setActiveSessionId(rehydrated.id, { history: 'replace' });
          restoreDraftFiles(rehydrated.id);

          reused = true;
        }
      }

      if (!reused) {
        logService.info('No active session found or empty session to reuse, starting fresh chat.');
        startNewChat(sortedList.length > 0 ? sortedList[0] : undefined, { history: 'replace' });
      }
    }
  } catch (error) {
    logService.error('Error loading chat history:', error);
    startNewChat(undefined, { history: 'replace' });
  }
};
