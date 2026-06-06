import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedChatSession } from '@/types';

vi.mock('@/services/db/dbService', async () => {
  const { createDbServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createDbServiceMockModule();
});

vi.mock('@/services/logService', async () => {
  const { createLogServiceMockModule } = await import('@/test/doubles/moduleMocks');

  return createLogServiceMockModule();
});

vi.mock('@/utils/modelSorting', () => ({
  resolveSupportedModelId: vi.fn((modelId: string | null | undefined, fallback: string) => modelId || fallback),
}));

import { dbService } from '@/services/db/dbService';
import { createChatMessage, createSavedChatSession } from '@/test/data/factories';
import { recordPendingSessionWrite } from '@/stores/sessionWriteJournal';
import { loadInitialSessionData } from './sessionInitialLoad';

describe('loadInitialSessionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('restores pending active session content when a refresh happens before IndexedDB save completes', async () => {
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
        createChatMessage({ id: 'm2', role: 'model', content: 'pending response' }),
      ],
    });

    recordPendingSessionWrite(pendingSession, 1);
    window.history.replaceState({}, '', '/chat/session-1');
    vi.mocked(dbService.getAllSessionMetadata).mockResolvedValue([{ ...persistedSession, messages: [] }]);
    vi.mocked(dbService.getAllGroups).mockResolvedValue([]);
    vi.mocked(dbService.getSession).mockResolvedValue(persistedSession);

    const setActiveMessages = vi.fn();
    const setActiveSessionId = vi.fn();

    await loadInitialSessionData({
      setSavedSessions: vi.fn(),
      setSavedGroups: vi.fn(),
      setActiveSessionId,
      setActiveMessages,
      restoreDraftFiles: vi.fn(),
      startNewChat: vi.fn(),
    });

    expect(setActiveSessionId).toHaveBeenCalledWith('session-1', { history: 'replace' });
    expect((setActiveMessages.mock.calls[0][0] as SavedChatSession['messages']).map((message) => message.id)).toEqual([
      'm1',
      'm2',
    ]);
    expect(dbService.saveSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
  });
});
