import { act } from 'react';
import { vi } from 'vitest';

export interface TestAnimationFrameController {
  readonly scheduledFrameCount: number;
  flushNextFrame(timestamp?: number): boolean;
  flushScheduledFrames(timestamp?: number): void;
}

export const installTestAnimationFrameController = ({
  frameStepMs = 16,
}: { frameStepMs?: number } = {}): TestAnimationFrameController => {
  let nextAnimationFrameId = 0;
  let currentTime = 0;
  const scheduledFrames = new Map<number, FrameRequestCallback>();

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      const frameId = ++nextAnimationFrameId;
      scheduledFrames.set(frameId, callback);
      return frameId;
    }),
  );

  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((frameId: number) => {
      scheduledFrames.delete(frameId);
    }),
  );

  const runFrame = (callback: FrameRequestCallback, timestamp?: number) => {
    currentTime = timestamp ?? currentTime + frameStepMs;

    act(() => {
      callback(currentTime);
    });
  };

  return {
    get scheduledFrameCount() {
      return scheduledFrames.size;
    },
    flushNextFrame(timestamp?: number) {
      const nextFrame = scheduledFrames.entries().next().value as [number, FrameRequestCallback] | undefined;

      if (!nextFrame) {
        return false;
      }

      const [frameId, callback] = nextFrame;
      scheduledFrames.delete(frameId);
      runFrame(callback, timestamp);

      return true;
    },
    flushScheduledFrames(timestamp?: number) {
      for (const [frameId, callback] of Array.from(scheduledFrames.entries())) {
        scheduledFrames.delete(frameId);
        runFrame(callback, timestamp);
      }
    },
  };
};
