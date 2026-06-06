import type { ChatMessage, SavedChatSession } from '@/types';
import { stripSessionFilePayloads } from '@/utils/chat/session';

const STORAGE_KEY = 'amc:pending-session-writes:v1';

interface PendingSessionWrite {
  session: SavedChatSession;
  version: number;
  recordedAt: number;
}

type PendingSessionWriteJournal = Record<string, PendingSessionWrite>;

const getStorage = (): Storage | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage;
};

const reviveDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const reviveMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  timestamp: reviveDate(message.timestamp) ?? new Date(),
  generationStartTime: reviveDate(message.generationStartTime),
  generationEndTime: reviveDate(message.generationEndTime),
});

const reviveSession = (session: SavedChatSession): SavedChatSession => ({
  ...session,
  messages: session.messages.map(reviveMessage),
});

const readJournal = (): PendingSessionWriteJournal => {
  const storage = getStorage();
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PendingSessionWriteJournal;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeJournal = (journal: PendingSessionWriteJournal) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const sessionIds = Object.keys(journal);
  try {
    if (sessionIds.length === 0) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    storage.removeItem(STORAGE_KEY);
  }
};

const isPendingSessionNewer = (pendingSession: SavedChatSession, persistedSession?: SavedChatSession | null) => {
  if (!persistedSession) {
    return true;
  }

  if (pendingSession.timestamp !== persistedSession.timestamp) {
    return pendingSession.timestamp > persistedSession.timestamp;
  }

  if (pendingSession.messages.length !== persistedSession.messages.length) {
    return pendingSession.messages.length > persistedSession.messages.length;
  }

  const pendingLastMessage = pendingSession.messages[pendingSession.messages.length - 1];
  const persistedLastMessage = persistedSession.messages[persistedSession.messages.length - 1];

  return (
    !pendingLastMessage ||
    !persistedLastMessage ||
    pendingLastMessage.id !== persistedLastMessage.id ||
    (pendingLastMessage.content.length >= persistedLastMessage.content.length &&
      (pendingLastMessage.thoughts?.length ?? 0) >= (persistedLastMessage.thoughts?.length ?? 0))
  );
};

export const recordPendingSessionWrite = (session: SavedChatSession, version: number) => {
  const journal = readJournal();
  journal[session.id] = {
    session: stripSessionFilePayloads(session),
    version,
    recordedAt: Date.now(),
  };
  writeJournal(journal);
};

export const clearPendingSessionWrite = (sessionId: string, version?: number) => {
  const journal = readJournal();
  const existing = journal[sessionId];
  if (!existing || (version !== undefined && existing.version !== version)) {
    return;
  }

  delete journal[sessionId];
  writeJournal(journal);
};

export const getPendingSessionWrite = (
  sessionId: string,
  persistedSession?: SavedChatSession | null,
): SavedChatSession | null => {
  const pending = getPendingSessionWriteRecord(sessionId, persistedSession);
  return pending?.session ?? null;
};

const getPendingSessionWriteRecord = (
  sessionId: string,
  persistedSession?: SavedChatSession | null,
): PendingSessionWrite | null => {
  const pending = readJournal()[sessionId];
  if (!pending) {
    return null;
  }

  const pendingSession = reviveSession(pending.session);
  return isPendingSessionNewer(pendingSession, persistedSession) ? { ...pending, session: pendingSession } : null;
};

export const mergePendingSessionWrites = (sessions: SavedChatSession[]): SavedChatSession[] => {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));

  Object.values(readJournal()).forEach((pending) => {
    const pendingSession = reviveSession(pending.session);
    const persistedSession = sessionsById.get(pendingSession.id);

    if (isPendingSessionNewer(pendingSession, persistedSession)) {
      sessionsById.set(pendingSession.id, pendingSession);
    }
  });

  return Array.from(sessionsById.values());
};

export const mergePendingSessionMetadata = (sessions: SavedChatSession[]): SavedChatSession[] =>
  mergePendingSessionWrites(sessions).map((session) => ({ ...session, messages: [] }));

export const resolveSessionWithPendingWrite = async (
  sessionId: string,
  getSession: (sessionId: string) => Promise<SavedChatSession | null | undefined>,
  saveSession: (session: SavedChatSession) => Promise<void>,
  onRecoveryError?: (error: unknown) => void,
): Promise<SavedChatSession | null | undefined> => {
  const persistedSession = await getSession(sessionId);
  const pending = getPendingSessionWriteRecord(sessionId, persistedSession);
  if (!pending) {
    return persistedSession;
  }

  try {
    void saveSession(pending.session)
      .then(() => clearPendingSessionWrite(sessionId, pending.version))
      .catch((error: unknown) => onRecoveryError?.(error));
  } catch (error) {
    onRecoveryError?.(error);
  }

  return pending.session;
};
