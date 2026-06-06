import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedChatSession } from '@/types';
import { createSavedChatSessionMetadata } from '@/test/data/factories';
import { persistSessionChanges } from './sessionPersistenceEffects';
import { getPendingSessionWrite, recordPendingSessionWrite } from './sessionWriteJournal';

describe('sessionPersistenceEffects', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves a changed active session and broadcasts a content update', async () => {
    const session = createSavedChatSessionMetadata({
      id: 'active',
      messages: [{ id: 'message', role: 'user', content: 'Hi', timestamp: new Date() }],
    });
    const saveSession = vi.fn();
    const broadcastSyncMessage = vi.fn();
    const sessionPersistVersions = new Map<string, number>();

    await persistSessionChanges({
      modifiedSessions: [session],
      deletedSessionIds: [],
      activeSessionId: 'active',
      sessionPersistVersions,
      getSession: vi.fn(),
      saveSession,
      deleteSession: vi.fn(),
      broadcastSyncMessage,
    });

    expect(sessionPersistVersions.get('active')).toBe(1);
    expect(saveSession).toHaveBeenCalledWith(session);
    expect(broadcastSyncMessage).toHaveBeenCalledWith({
      type: 'SESSION_CONTENT_UPDATED',
      sessionId: 'active',
    });
  });

  it('keeps a synchronous pending write until the matching active session save succeeds', async () => {
    let resolveSave: () => void = () => {};
    const session = createSavedChatSessionMetadata({
      id: 'active',
      messages: [
        { id: 'message-1', role: 'user', content: 'Hi', timestamp: new Date() },
        { id: 'message-2', role: 'model', content: 'There', timestamp: new Date() },
      ],
    });
    const saveSession = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const persistPromise = persistSessionChanges({
      modifiedSessions: [session],
      deletedSessionIds: [],
      activeSessionId: 'active',
      sessionPersistVersions: new Map(),
      getSession: vi.fn(),
      saveSession,
      deleteSession: vi.fn(),
      broadcastSyncMessage: vi.fn(),
    });

    expect(getPendingSessionWrite('active')?.messages.map((message) => message.id)).toEqual(['message-1', 'message-2']);

    await vi.waitFor(() => expect(saveSession).toHaveBeenCalledWith(session));
    resolveSave();
    await persistPromise;

    expect(getPendingSessionWrite('active')).toBeNull();
  });

  it('preserves persisted messages when saving a metadata-only inactive session', async () => {
    const persistedMessage = {
      id: 'persisted-message',
      role: 'model' as const,
      content: 'Keep me',
      timestamp: new Date(),
    };
    const session = createSavedChatSessionMetadata({ id: 'archive', title: 'Renamed', messages: [] });
    const persistedSession = createSavedChatSessionMetadata({
      id: 'archive',
      title: 'Archive',
      messages: [persistedMessage],
    });
    const saveSession = vi.fn();

    await persistSessionChanges({
      modifiedSessions: [session],
      deletedSessionIds: [],
      activeSessionId: null,
      sessionPersistVersions: new Map(),
      getSession: vi.fn(async () => persistedSession),
      saveSession,
      deleteSession: vi.fn(),
      broadcastSyncMessage: vi.fn(),
    });

    expect(saveSession).toHaveBeenCalledWith({
      ...persistedSession,
      ...session,
      settings: { ...persistedSession.settings, ...session.settings },
      messages: [persistedMessage],
    });
  });

  it('skips stale session saves when a newer persist version appears before DB lookup finishes', async () => {
    let resolvePersistedSession: (session: SavedChatSession) => void = () => {};
    const sessionPersistVersions = new Map<string, number>();
    const session = createSavedChatSessionMetadata({ id: 'archive', messages: [] });
    const saveSession = vi.fn();

    const persistPromise = persistSessionChanges({
      modifiedSessions: [session],
      deletedSessionIds: [],
      activeSessionId: null,
      sessionPersistVersions,
      getSession: vi.fn(
        () =>
          new Promise<SavedChatSession>((resolve) => {
            resolvePersistedSession = resolve;
          }),
      ),
      saveSession,
      deleteSession: vi.fn(),
      broadcastSyncMessage: vi.fn(),
    });

    expect(sessionPersistVersions.get('archive')).toBe(1);
    sessionPersistVersions.set('archive', 2);
    resolvePersistedSession(createSavedChatSessionMetadata({ id: 'archive', messages: [] }));
    await persistPromise;

    expect(saveSession).not.toHaveBeenCalled();
  });

  it('deletes removed sessions and broadcasts a sessions update', async () => {
    const deleteSession = vi.fn();
    const broadcastSyncMessage = vi.fn();
    recordPendingSessionWrite(createSavedChatSessionMetadata({ id: 'removed' }), 1);

    await persistSessionChanges({
      modifiedSessions: [],
      deletedSessionIds: ['removed'],
      activeSessionId: null,
      sessionPersistVersions: new Map(),
      getSession: vi.fn(),
      saveSession: vi.fn(),
      deleteSession,
      broadcastSyncMessage,
    });

    expect(deleteSession).toHaveBeenCalledWith('removed');
    expect(getPendingSessionWrite('removed')).toBeNull();
    expect(broadcastSyncMessage).toHaveBeenCalledWith({ type: 'SESSIONS_UPDATED' });
  });
});
