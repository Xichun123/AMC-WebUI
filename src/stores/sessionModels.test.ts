import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_ID } from '@/constants/modelConfiguration';
import type { SavedChatSession } from '@/types';
import { createSavedChatSessionMetadata } from '@/test/data/factories';
import { sanitizeSessionModel, shouldRetainRuntimeMessages, sortSessionsInPlace } from './sessionModels';

describe('sessionModels', () => {
  it('sorts pinned sessions first, then by newest timestamp', () => {
    const sessions = [
      createSavedChatSessionMetadata({ id: 'old', timestamp: 1 }),
      createSavedChatSessionMetadata({ id: 'pinned-old', timestamp: 2, isPinned: true }),
      createSavedChatSessionMetadata({ id: 'new', timestamp: 4 }),
      createSavedChatSessionMetadata({ id: 'pinned-new', timestamp: 3, isPinned: true }),
    ];

    const sorted = sortSessionsInPlace(sessions);

    expect(sorted).toBe(sessions);
    expect(sorted.map((session) => session.id)).toEqual(['pinned-new', 'pinned-old', 'new', 'old']);
  });

  it('keeps runtime messages for the active session and loading sessions only', () => {
    const loadingSessionIds = new Set(['loading-session']);

    expect(shouldRetainRuntimeMessages('active-session', 'active-session', loadingSessionIds)).toBe(true);
    expect(shouldRetainRuntimeMessages('loading-session', 'active-session', loadingSessionIds)).toBe(true);
    expect(shouldRetainRuntimeMessages('inactive-session', 'active-session', loadingSessionIds)).toBe(false);
  });

  it('sanitizes missing model IDs to the default supported model', () => {
    const sanitized = sanitizeSessionModel(
      createSavedChatSessionMetadata({
        settings: {
          temperature: 1,
        } as SavedChatSession['settings'],
      }),
    );

    expect(sanitized.settings.modelId).toBe(DEFAULT_MODEL_ID);
  });
});
