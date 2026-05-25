import { type TouchEvent, useCallback, useEffect, useRef } from 'react';
import { DESKTOP_BREAKPOINT_PX } from '@/constants/layout';
import { useUIStore } from '@/stores/uiStore';

const SETTINGS_MODAL_HISTORY_STATE = 'settings';

const isSidebarElement = (target: EventTarget | null) =>
  target instanceof Element && target.closest('[data-history-sidebar-root="true"]') !== null;

const isPlainHistoryState = (state: unknown): state is Record<string, unknown> =>
  state !== null && typeof state === 'object' && !Array.isArray(state);

const isSettingsModalHistoryState = (state: unknown) =>
  isPlainHistoryState(state) && state.amcModal === SETTINGS_MODAL_HISTORY_STATE;

const getCurrentRelativeUrl = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const useAppUi = () => {
  const isSettingsModalOpen = useUIStore((s) => s.isSettingsModalOpen);
  const isPreloadedMessagesModalOpen = useUIStore((s) => s.isPreloadedMessagesModalOpen);
  const isHistorySidebarOpen = useUIStore((s) => s.isHistorySidebarOpen);
  const isLogViewerOpen = useUIStore((s) => s.isLogViewerOpen);
  const setIsSettingsModalOpen = useUIStore((s) => s.setIsSettingsModalOpen);
  const setIsPreloadedMessagesModalOpen = useUIStore((s) => s.setIsPreloadedMessagesModalOpen);
  const setIsHistorySidebarOpen = useUIStore((s) => s.setIsHistorySidebarOpen);
  const setIsHistorySidebarOpenTransient = useUIStore((s) => s.setIsHistorySidebarOpenTransient);
  const syncHistorySidebarForViewport = useUIStore((s) => s.syncHistorySidebarForViewport);
  const setIsLogViewerOpen = useUIStore((s) => s.setIsLogViewerOpen);

  const touchStartRef = useRef({ x: 0, y: 0, startedInSidebar: false });
  const wasDesktopRef = useRef(window.innerWidth >= DESKTOP_BREAKPOINT_PX);
  const settingsHistoryPushedRef = useRef(false);
  const wasSettingsModalOpenRef = useRef(isSettingsModalOpen);
  const resizeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const syncSidebarForCurrentViewport = () => {
      resizeFrameRef.current = null;
      const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT_PX;
      if (isDesktop !== wasDesktopRef.current) {
        wasDesktopRef.current = isDesktop;
        syncHistorySidebarForViewport();
      }
    };

    const handleResize = () => {
      if (resizeFrameRef.current !== null) {
        return;
      }

      resizeFrameRef.current = window.requestAnimationFrame(syncSidebarForCurrentViewport);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [syncHistorySidebarForViewport]);

  useEffect(() => {
    if (!isSettingsModalOpen || window.innerWidth >= DESKTOP_BREAKPOINT_PX || settingsHistoryPushedRef.current) {
      return;
    }

    const currentState = window.history.state;

    if (isSettingsModalHistoryState(currentState)) {
      settingsHistoryPushedRef.current = true;
      return;
    }

    try {
      window.history.pushState(
        {
          ...(isPlainHistoryState(currentState) ? currentState : {}),
          amcModal: SETTINGS_MODAL_HISTORY_STATE,
        },
        '',
        getCurrentRelativeUrl(),
      );
      settingsHistoryPushedRef.current = true;
    } catch {
      settingsHistoryPushedRef.current = false;
    }
  }, [isSettingsModalOpen]);

  useEffect(() => {
    if (!isSettingsModalOpen || !settingsHistoryPushedRef.current) {
      return;
    }

    const handlePopState = () => {
      if (!settingsHistoryPushedRef.current) {
        return;
      }

      settingsHistoryPushedRef.current = false;
      setIsSettingsModalOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSettingsModalOpen, setIsSettingsModalOpen]);

  useEffect(() => {
    const wasSettingsModalOpen = wasSettingsModalOpenRef.current;
    wasSettingsModalOpenRef.current = isSettingsModalOpen;

    if (!wasSettingsModalOpen || isSettingsModalOpen || !settingsHistoryPushedRef.current) {
      return;
    }

    settingsHistoryPushedRef.current = false;

    if (isSettingsModalHistoryState(window.history.state)) {
      try {
        window.history.back();
      } catch {
        // Ignore browsers that reject synthetic history navigation.
      }
    }
  }, [isSettingsModalOpen]);

  useEffect(() => {
    const handleHomeRoutePopState = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT_PX || window.location.pathname !== '/') {
        return;
      }

      setIsHistorySidebarOpenTransient(false);
    };

    window.addEventListener('popstate', handleHomeRoutePopState);
    return () => window.removeEventListener('popstate', handleHomeRoutePopState);
  }, [setIsHistorySidebarOpenTransient]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) {
      return;
    }

    const firstTouch = e.touches[0];
    if (firstTouch) {
      touchStartRef.current = {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
        startedInSidebar: isSidebarElement(e.target),
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) {
        return;
      }

      const lastTouch = e.changedTouches[0];
      if (!lastTouch) return;

      const deltaX = lastTouch.clientX - touchStartRef.current.x;
      const deltaY = lastTouch.clientY - touchStartRef.current.y;
      const swipeThreshold = 50;
      const edgeThreshold = 40;

      if (Math.abs(deltaX) < Math.abs(deltaY)) {
        return;
      }

      if (deltaX > swipeThreshold && !isHistorySidebarOpen && touchStartRef.current.x < edgeThreshold) {
        setIsHistorySidebarOpen(true);
      } else if (deltaX < -swipeThreshold && isHistorySidebarOpen && touchStartRef.current.startedInSidebar) {
        setIsHistorySidebarOpen(false);
      }
    },
    [isHistorySidebarOpen, setIsHistorySidebarOpen],
  );

  return {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isPreloadedMessagesModalOpen,
    setIsPreloadedMessagesModalOpen,
    isHistorySidebarOpen,
    setIsHistorySidebarOpen,
    setIsHistorySidebarOpenTransient,
    isLogViewerOpen,
    setIsLogViewerOpen,
    handleTouchStart,
    handleTouchEnd,
  };
};
