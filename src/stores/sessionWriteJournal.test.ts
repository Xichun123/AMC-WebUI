import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChatMessage, createSavedChatSession } from '@/test/data/factories';
import {
  clearPendingSessionWrite,
  getPendingSessionWrite,
  mergePendingSessionMetadata,
  recordPendingSessionWrite,
  resolveSessionWithPendingWrite,
} from './sessionWriteJournal';

describe('sessionWriteJournal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns a pending session when it has more messages than the persisted copy', () => {
    const persistedSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [createChatMessage({ id: 'm1', content: 'persisted' })],
    });
    const pendingSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [
        createChatMessage({ id: 'm1', content: 'persisted' }),
        createChatMessage({ id: 'm2', content: 'pending' }),
      ],
    });

    recordPendingSessionWrite(pendingSession, 1);

    expect(getPendingSessionWrite('session-1', persistedSession)?.messages.map((message) => message.id)).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('does not let an older pending write replace newer persisted metadata', () => {
    const olderPendingSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [createChatMessage({ id: 'm1' })],
    });
    const newerPersistedSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 20,
      title: 'Newer DB',
      messages: [createChatMessage({ id: 'm1' })],
    });

    recordPendingSessionWrite(olderPendingSession, 1);

    expect(mergePendingSessionMetadata([newerPersistedSession])[0].title).toBe('Newer DB');
  });

  it('does not let a shorter same-timestamp pending message replace fuller persisted content', () => {
    const pendingSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [createChatMessage({ id: 'm1', content: 'short' })],
    });
    const persistedSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [createChatMessage({ id: 'm1', content: 'short but already saved in full' })],
    });

    recordPendingSessionWrite(pendingSession, 1);

    expect(getPendingSessionWrite('session-1', persistedSession)).toBeNull();
  });

  it('only clears the pending write for the matching persist version', () => {
    recordPendingSessionWrite(createSavedChatSession({ id: 'session-1', timestamp: 10 }), 1);
    recordPendingSessionWrite(createSavedChatSession({ id: 'session-1', timestamp: 20 }), 2);

    clearPendingSessionWrite('session-1', 1);

    expect(getPendingSessionWrite('session-1')?.timestamp).toBe(20);
  });

  it('recovers pending session content and clears the same version after DB repair succeeds', async () => {
    const persistedSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [createChatMessage({ id: 'm1' })],
    });
    const pendingSession = createSavedChatSession({
      id: 'session-1',
      timestamp: 10,
      messages: [createChatMessage({ id: 'm1' }), createChatMessage({ id: 'm2' })],
    });
    const saveSession = vi.fn(async () => undefined);

    recordPendingSessionWrite(pendingSession, 7);

    const resolved = await resolveSessionWithPendingWrite(
      'session-1',
      vi.fn(async () => persistedSession),
      saveSession,
    );
    await vi.waitFor(() => expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' })));

    expect(resolved?.messages.map((message) => message.id)).toEqual(['m1', 'm2']);
    expect(getPendingSessionWrite('session-1')).toBeNull();
  });
});
