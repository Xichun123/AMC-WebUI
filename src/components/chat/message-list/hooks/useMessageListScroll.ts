import { useRef, useState, useCallback, useEffect } from 'react';
import { type VirtuosoHandle } from 'react-virtuoso';
import { type ChatMessage } from '@/types';

interface UseMessageListScrollProps {
  messages: ChatMessage[];
  setScrollContainerRef: (node: HTMLDivElement | null) => void;
  activeSessionId: string | null;
}

const CURRENT_TURN_VIEWPORT_OFFSET_PX = 96;

type StoredScrollSnapshot = {
  messageId: string;
  scrollTop: number;
  topOffset: number;
};

const getScrollStorageKey = (sessionId: string) => `chat_scroll_pos_${sessionId}`;

const parseStoredScrollSnapshot = (rawValue: string | null): StoredScrollSnapshot | number | null => {
  if (rawValue === null) {
    return null;
  }

  const legacyTop = Number(rawValue);
  if (Number.isFinite(legacyTop)) {
    return legacyTop;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredScrollSnapshot>;
    if (
      typeof parsed.messageId === 'string' &&
      Number.isFinite(parsed.scrollTop) &&
      Number.isFinite(parsed.topOffset)
    ) {
      return {
        messageId: parsed.messageId,
        scrollTop: Number(parsed.scrollTop),
        topOffset: Number(parsed.topOffset),
      };
    }
    if (Number.isFinite(parsed.scrollTop)) {
      return Number(parsed.scrollTop);
    }
  } catch {
    return null;
  }

  return null;
};

const createScrollSnapshot = (container: HTMLElement): StoredScrollSnapshot | null => {
  const containerRect = container.getBoundingClientRect();
  const renderedMessages = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'));
  const firstVisibleMessage =
    renderedMessages.find((element) => element.getBoundingClientRect().top >= containerRect.top) ??
    renderedMessages.find((element) => element.getBoundingClientRect().bottom > containerRect.top);

  const messageId = firstVisibleMessage?.dataset.messageId;
  if (!firstVisibleMessage || !messageId) {
    return null;
  }

  return {
    messageId,
    scrollTop: Math.max(0, Math.round(container.scrollTop)),
    topOffset: Math.round(firstVisibleMessage.getBoundingClientRect().top - containerRect.top),
  };
};

export const useMessageListScroll = ({
  messages,
  setScrollContainerRef,
  activeSessionId,
}: UseMessageListScrollProps) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [scrollerRef, setInternalScrollerRef] = useState<HTMLElement | null>(null);
  const visibleRangeRef = useRef({ startIndex: 0, endIndex: 0 });

  const scrollSaveTimeoutRef = useRef<number | null>(null);
  const anchorTimeoutRef = useRef<number | null>(null);
  const restoreTimeoutRef = useRef<number | null>(null);
  const lastRestoredSessionIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);

  const lastScrollTarget = useRef<number | null>(null);
  const prevMsgCount = useRef(messages.length);
  const prevSessionIdForAnchor = useRef(activeSessionId);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const clearAnchorTimeout = useCallback(() => {
    if (anchorTimeoutRef.current !== null) {
      clearTimeout(anchorTimeoutRef.current);
      anchorTimeoutRef.current = null;
    }
  }, []);

  const clearRestoreTimeout = useCallback(() => {
    if (restoreTimeoutRef.current !== null) {
      clearTimeout(restoreTimeoutRef.current);
      restoreTimeoutRef.current = null;
    }
  }, []);

  const onRangeChanged = useCallback(({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
    visibleRangeRef.current = { startIndex, endIndex };
    setVisibleStartIndex(startIndex);
  }, []);

  const handleScrollerRef = useCallback(
    (ref: Window | HTMLElement | null) => {
      if (ref === null || ref instanceof HTMLElement) {
        setInternalScrollerRef(ref);
        setScrollContainerRef(ref as HTMLDivElement | null);
      }
    },
    [setScrollContainerRef],
  );

  useEffect(() => {
    const sessionChanged = prevSessionIdForAnchor.current !== activeSessionId;
    const restorationPending = lastRestoredSessionIdRef.current !== activeSessionId;

    // Let history restoration settle before applying new-turn anchoring.
    if (sessionChanged || restorationPending) {
      prevSessionIdForAnchor.current = activeSessionId;
      prevMsgCount.current = messages.length;
      return;
    }

    if (messages.length > prevMsgCount.current) {
      let targetIndex = -1;
      for (let i = messages.length - 1; i >= Math.max(0, prevMsgCount.current - 1); i--) {
        if (messages[i].role === 'model') {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex !== -1) {
        const sessionIdForScroll = activeSessionId;
        clearAnchorTimeout();
        anchorTimeoutRef.current = window.setTimeout(() => {
          anchorTimeoutRef.current = null;
          if (activeSessionIdRef.current !== sessionIdForScroll) return;
          virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align: 'start',
            behavior: 'smooth',
          });
          lastScrollTarget.current = targetIndex;
        }, 50);
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages, activeSessionId, clearAnchorTimeout]);

  const scrollToPrevTurn = useCallback(() => {
    clearAnchorTimeout();

    const currentStartIndex = visibleRangeRef.current.startIndex;
    let targetIndex = -1;

    for (let i = Math.max(0, currentStartIndex - 1); i >= 0; i--) {
      if (messages[i].role === 'user') {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== -1) {
      lastScrollTarget.current = targetIndex;
      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'start', behavior: 'smooth' });
    } else {
      virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' });
    }
  }, [messages, clearAnchorTimeout]);

  const scrollToNextTurn = useCallback(() => {
    clearAnchorTimeout();

    const renderedTurnNavigation = (() => {
      if (!scrollerRef) {
        return null;
      }

      const messageIndexById = new Map(messages.map((message, index) => [message.id, index]));
      const viewportTop = scrollerRef.getBoundingClientRect().top;
      const currentTurnThreshold = viewportTop + CURRENT_TURN_VIEWPORT_OFFSET_PX;
      const renderedUserTurns = Array.from(
        scrollerRef.querySelectorAll<HTMLElement>('[data-message-role="user"][data-message-id]'),
      );

      let currentUserTurnIndex: number | null = null;
      let nextUserTurnIndex: number | null = null;

      for (const userTurnElement of renderedUserTurns) {
        const messageId = userTurnElement.dataset.messageId;
        if (!messageId) continue;

        const messageIndex = messageIndexById.get(messageId);
        if (messageIndex === undefined) continue;

        if (userTurnElement.getBoundingClientRect().top <= currentTurnThreshold) {
          currentUserTurnIndex = messageIndex;
          continue;
        }

        nextUserTurnIndex = messageIndex;
        break;
      }

      return { currentUserTurnIndex, nextUserTurnIndex };
    })();

    let targetIndex = -1;

    if (renderedTurnNavigation?.nextUserTurnIndex !== null && renderedTurnNavigation?.nextUserTurnIndex !== undefined) {
      targetIndex = renderedTurnNavigation.nextUserTurnIndex;
    } else {
      const currentStartIndex = visibleRangeRef.current.startIndex;
      const cursorIndex =
        renderedTurnNavigation?.currentUserTurnIndex ??
        (lastScrollTarget.current !== null && lastScrollTarget.current >= currentStartIndex
          ? lastScrollTarget.current
          : currentStartIndex);

      for (let i = cursorIndex + 1; i < messages.length; i++) {
        if (messages[i].role === 'user') {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return;
      }
    }

    lastScrollTarget.current = targetIndex;
    virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'start', behavior: 'smooth' });
  }, [messages, scrollerRef, clearAnchorTimeout]);

  const scrollToTop = useCallback(() => {
    if (messages.length === 0) {
      return;
    }

    clearAnchorTimeout();
    lastScrollTarget.current = 0;
    virtuosoRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' });
  }, [messages.length, clearAnchorTimeout]);

  const scrollToBottom = useCallback(() => {
    if (messages.length === 0) {
      return;
    }

    clearAnchorTimeout();
    lastScrollTarget.current = messages.length - 1;
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'smooth' });
  }, [messages.length, clearAnchorTimeout]);

  const handleScroll = useCallback(() => {
    if (document.hidden) return;

    const container = scrollerRef;
    if (container) {
      const { scrollTop } = container;

      if (activeSessionId && lastRestoredSessionIdRef.current === activeSessionId && messages.length > 0) {
        const snapshot = createScrollSnapshot(container) ?? { scrollTop: Math.max(0, Math.round(scrollTop)) };
        if (scrollSaveTimeoutRef.current) {
          clearTimeout(scrollSaveTimeoutRef.current);
        }
        scrollSaveTimeoutRef.current = window.setTimeout(() => {
          localStorage.setItem(getScrollStorageKey(activeSessionId), JSON.stringify(snapshot));
        }, 300);
      }
    }
  }, [scrollerRef, activeSessionId, messages.length]);

  useEffect(() => {
    return () => {
      if (scrollSaveTimeoutRef.current) {
        clearTimeout(scrollSaveTimeoutRef.current);
      }
      clearAnchorTimeout();
      clearRestoreTimeout();
    };
  }, [clearAnchorTimeout, clearRestoreTimeout]);

  useEffect(() => {
    if (!activeSessionId) return;

    if (lastRestoredSessionIdRef.current !== activeSessionId) {
      if (messages.length > 0) {
        const savedSnapshot = parseStoredScrollSnapshot(localStorage.getItem(getScrollStorageKey(activeSessionId)));
        const sessionIdForRestore = activeSessionId;
        clearRestoreTimeout();

        restoreTimeoutRef.current = window.setTimeout(() => {
          restoreTimeoutRef.current = null;
          if (activeSessionIdRef.current !== sessionIdForRestore) return;

          if (typeof savedSnapshot === 'number') {
            virtuosoRef.current?.scrollTo({ top: savedSnapshot });
          } else if (savedSnapshot) {
            const targetIndex = messages.findIndex((message) => message.id === savedSnapshot.messageId);
            if (targetIndex >= 0) {
              virtuosoRef.current?.scrollToIndex({
                index: targetIndex,
                align: 'start',
                offset: -savedSnapshot.topOffset,
              });
            } else {
              virtuosoRef.current?.scrollTo({ top: savedSnapshot.scrollTop });
            }
          } else {
            virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
          }
          lastRestoredSessionIdRef.current = sessionIdForRestore;
        }, 50);
      }
    }
  }, [activeSessionId, messages, clearRestoreTimeout]);

  const showScrollDown =
    !atBottom && messages.some((message, index) => index > visibleStartIndex && message.role === 'user');
  const showScrollUp = visibleStartIndex > 0;

  return {
    virtuosoRef,
    handleScrollerRef,
    setAtBottom,
    onRangeChanged,
    scrollToPrevTurn,
    scrollToNextTurn,
    scrollToTop,
    scrollToBottom,
    showScrollDown,
    showScrollUp,
    scrollerRef,
    handleScroll,
  };
};
