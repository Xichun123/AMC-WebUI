import { act } from 'react';
import { installTestAnimationFrameController, type TestAnimationFrameController } from '@/test/browser/animationFrames';
import { setupTestRenderer } from '@/test/render/renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSmoothStreaming } from './useSmoothStreaming';

const OUTPUT_SELECTOR = '[data-testid="stream-output"]';

const TestComponent = ({ text, isStreaming }: { text: string; isStreaming: boolean }) => {
  const displayedText = useSmoothStreaming(text, isStreaming);
  return <div data-testid="stream-output">{displayedText}</div>;
};

describe('useSmoothStreaming', () => {
  const renderer = setupTestRenderer();
  let animationFrames: TestAnimationFrameController;

  const flushUntilTextMatches = (expectedText: string, maxFrames = 20) => {
    for (let i = 0; i < maxFrames; i += 1) {
      if (renderer.container.querySelector(OUTPUT_SELECTOR)?.textContent === expectedText) {
        return;
      }

      if (!animationFrames.flushNextFrame()) {
        return;
      }
    }
  };

  beforeEach(() => {
    animationFrames = installTestAnimationFrameController();

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stops scheduling animation frames after catching up to the current text', () => {
    act(() => {
      renderer.root.render(<TestComponent text="abc" isStreaming />);
    });

    expect(animationFrames.scheduledFrameCount).toBe(1);

    flushUntilTextMatches('abc');

    expect(renderer.container.querySelector(OUTPUT_SELECTOR)).toHaveTextContent('abc');
    expect(animationFrames.scheduledFrameCount).toBe(0);
  });

  it('restarts animation when new streamed text arrives after the previous text finished rendering', () => {
    act(() => {
      renderer.root.render(<TestComponent text="abc" isStreaming />);
    });

    flushUntilTextMatches('abc');

    expect(renderer.container.querySelector(OUTPUT_SELECTOR)).toHaveTextContent('abc');
    expect(animationFrames.scheduledFrameCount).toBe(0);

    act(() => {
      renderer.root.render(<TestComponent text="abcdef" isStreaming />);
    });

    expect(animationFrames.scheduledFrameCount).toBe(1);

    flushUntilTextMatches('abcdef');

    expect(renderer.container.querySelector(OUTPUT_SELECTOR)).toHaveTextContent('abcdef');
    expect(animationFrames.scheduledFrameCount).toBe(0);
  });

  it('bypasses character-by-character animation for markdown tables while streaming', () => {
    const tableMarkdown = ['| Name | Score |', '| --- | --- |', '| Alice | 42 |'].join('\n');

    act(() => {
      renderer.root.render(<TestComponent text={tableMarkdown} isStreaming />);
    });

    expect(renderer.container.querySelector(OUTPUT_SELECTOR)?.textContent).toBe(tableMarkdown);
    expect(animationFrames.scheduledFrameCount).toBe(0);
  });

  it('bypasses character-by-character animation for streaming Live Artifact html candidates', () => {
    const partialArtifact = '<div style="display:grid"><strong>Streaming artifact';

    act(() => {
      renderer.root.render(<TestComponent text={partialArtifact} isStreaming />);
    });

    expect(renderer.container.querySelector(OUTPUT_SELECTOR)?.textContent).toBe(partialArtifact);
    expect(animationFrames.scheduledFrameCount).toBe(0);
  });

  it('bypasses character-by-character animation for streaming fenced interaction artifacts', () => {
    const partialInteraction = '```amc-live-artifact-interaction\n{"instruction":"Collect","schema":{';

    act(() => {
      renderer.root.render(<TestComponent text={partialInteraction} isStreaming />);
    });

    expect(renderer.container.querySelector(OUTPUT_SELECTOR)?.textContent).toBe(partialInteraction);
    expect(animationFrames.scheduledFrameCount).toBe(0);
  });
});
