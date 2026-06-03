import { useState, useEffect, useRef } from 'react';
import {
  isLikelyStreamingHtmlArtifact,
  isLikelyStreamingLiveArtifactInteractionJson,
} from '@/utils/previewableMarkdown';

const FENCED_CODE_BLOCK_REGEX = /(```[\s\S]*?```|```[\s\S]*$)/g;
const GFM_TABLE_REGEX = /(?:^|\n)\|[^\n]*\|\s*\n\|(?:\s*:?-{3,}:?\s*\|)+/;
const RENDER_THROTTLE_MS = 60;
const DEFAULT_CHARS_PER_FRAME = 1;
const CATCH_UP_SPEEDS = [
  { lagThreshold: 200, charsPerFrame: 15 },
  { lagThreshold: 100, charsPerFrame: 8 },
  { lagThreshold: 50, charsPerFrame: 5 },
  { lagThreshold: 20, charsPerFrame: 3 },
  { lagThreshold: 5, charsPerFrame: 2 },
] as const;

const hasStreamingSensitiveMarkdownTable = (text: string) => {
  return text.split(FENCED_CODE_BLOCK_REGEX).some((segment, index) => index % 2 === 0 && GFM_TABLE_REGEX.test(segment));
};

const getCharsToAdd = (lag: number): number =>
  CATCH_UP_SPEEDS.find(({ lagThreshold }) => lag > lagThreshold)?.charsPerFrame ?? DEFAULT_CHARS_PER_FRAME;

/**
 * A hook that provides a "typing effect" for streaming text.
 * It catches up to the target text smoothly instead of jumping in large chunks.
 */
export const useSmoothStreaming = (text: string | undefined | null, isStreaming: boolean) => {
  const safeText = text || '';
  const isDocumentHidden = typeof document !== 'undefined' && document.hidden;
  const shouldBypassAnimation =
    isStreaming &&
    (isDocumentHidden ||
      hasStreamingSensitiveMarkdownTable(safeText) ||
      isLikelyStreamingHtmlArtifact(safeText) ||
      isLikelyStreamingLiveArtifactInteractionJson(safeText));
  const [displayedText, setDisplayedText] = useState(isStreaming ? '' : safeText);

  const displayedTextRef = useRef(isStreaming ? '' : safeText);
  const targetTextRef = useRef(safeText);
  const animationFrameRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);

  useEffect(() => {
    targetTextRef.current = safeText;

    // Skip character-level animation when the tab is hidden or the content contains
    // markdown tables, because repeatedly reparsing partial table states creates
    // visible structural jank in the chat bubble.
    if (shouldBypassAnimation) {
      displayedTextRef.current = safeText;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    if (!isStreaming) {
      if (displayedTextRef.current !== safeText) {
        displayedTextRef.current = safeText;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [safeText, isStreaming, shouldBypassAnimation]);

  useEffect(() => {
    if (!isStreaming || shouldBypassAnimation) return;

    const animate = (time: DOMHighResTimeStamp) => {
      if (typeof document !== 'undefined' && document.hidden) {
        animationFrameRef.current = null;
        return;
      }

      const currentLen = displayedTextRef.current.length;
      const targetLen = targetTextRef.current.length;

      if (currentLen < targetLen) {
        const lag = targetLen - currentLen;
        const charsToAdd = getCharsToAdd(lag);

        const nextText = targetTextRef.current.slice(0, currentLen + charsToAdd);
        displayedTextRef.current = nextText;

        const isFinishedCatchingUp = nextText.length >= targetLen;

        if (isFinishedCatchingUp || time - lastRenderTimeRef.current > RENDER_THROTTLE_MS) {
          setDisplayedText(nextText);
          lastRenderTimeRef.current = time;
        }

        if (isFinishedCatchingUp) {
          animationFrameRef.current = null;
        } else {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      } else if (currentLen > targetLen) {
        displayedTextRef.current = targetTextRef.current;
        setDisplayedText(targetTextRef.current);
        lastRenderTimeRef.current = time;
        animationFrameRef.current = null;
      } else {
        animationFrameRef.current = null;
      }
    };

    if (!animationFrameRef.current && displayedTextRef.current !== targetTextRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isStreaming, safeText, shouldBypassAnimation]);

  return shouldBypassAnimation ? safeText : isStreaming ? displayedText : safeText;
};
