import { expect } from 'vitest';

const MODEL_BADGE_KEYS = ['pinned', 'flash', 'pro', 'gemma', 'live', 'tts', 'image', 'robotics'] as const;

export const expectNoModelBadges = (container: ParentNode) => {
  for (const badgeKey of MODEL_BADGE_KEYS) {
    expect(container.querySelector(`[data-badge-key="${badgeKey}"]`)).toBeNull();
  }
};
