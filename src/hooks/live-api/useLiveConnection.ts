import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import type { LiveServerMessage, Part, Session as LiveSession, Tool } from '@google/genai';
import { float32ToPCM16Base64 } from '@/features/audio/audioProcessing';
import { getLiveApiClient, LiveApiAuthConfigurationError } from '@/services/api/liveApiAuth';
import { logService } from '@/services/logService';
import type { AppSettings, LiveTranscriptHandler } from '@/types';
import type { LiveErrorState } from '@/utils/live-api/liveErrorState';
import { useStateWithRef } from '@/hooks/useStateWithRef';

const MAX_RECONNECT_RETRIES = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

interface UseLiveConnectionProps {
  appSettings: AppSettings;
  modelId: string;
  liveConfig: unknown;
  liveApiKeyForConnection?: string | null;
  tools: Tool[];
  initializeAudio: (
    onAudioData: (data: Float32Array) => void,
  ) => Promise<void | { audioCtx: AudioContext; inputCtx: AudioContext }>;
  cleanupAudio: () => void;
  clearBufferedAudio?: () => void;
  stopVideo: () => void;
  handleMessage: (msg: LiveServerMessage) => void;
  onClose?: () => void;
  onTranscript?: LiveTranscriptHandler;
  setSessionHandle: (handle: string | null) => void;
  sessionHandleRef: MutableRefObject<string | null>;
  sessionRef: MutableRefObject<Promise<LiveSession> | null>;
}

export const useLiveConnection = ({
  appSettings,
  modelId,
  liveConfig,
  liveApiKeyForConnection,
  tools,
  initializeAudio,
  cleanupAudio,
  clearBufferedAudio,
  stopVideo,
  handleMessage,
  onClose,
  onTranscript,
  setSessionHandle,
  sessionHandleRef,
  sessionRef,
}: UseLiveConnectionProps) => {
  const [isConnected, setIsConnected, isConnectedRef] = useStateWithRef(false);
  const [errorState, setErrorState] = useState<LiveErrorState | null>(null);
  const [isReconnecting, setIsReconnecting, isReconnectingRef] = useStateWithRef(false);

  const isProactiveReconnectRef = useRef(false);
  const disconnectRef = useRef<() => void>(() => {});
  const isConnectingRef = useRef(false);
  const setupCompleteResolveRef = useRef<(() => void) | null>(null);
  const setupCompleteRejectRef = useRef<((error: Error) => void) | null>(null);

  const retryCountRef = useRef(0);
  const isUserDisconnectRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => Promise<boolean>>(async () => false);

  const resetAudioState = useCallback(() => {
    clearBufferedAudio?.();
    cleanupAudio();
  }, [clearBufferedAudio, cleanupAudio]);

  const clearSetupCompleteWaiters = useCallback(() => {
    setupCompleteResolveRef.current = null;
    setupCompleteRejectRef.current = null;
  }, []);

  const resolveSetupComplete = useCallback(() => {
    setupCompleteResolveRef.current?.();
    clearSetupCompleteWaiters();
  }, [clearSetupCompleteWaiters]);

  const rejectSetupComplete = useCallback(
    (error: Error) => {
      setupCompleteRejectRef.current?.(error);
      clearSetupCompleteWaiters();
    },
    [clearSetupCompleteWaiters],
  );

  const setTranslationError = useCallback((key: string, values?: Record<string, string | number>) => {
    setErrorState({ kind: 'translation', key, values });
  }, []);

  const setRawError = useCallback((message: string) => {
    setErrorState({ kind: 'raw', message });
  }, []);

  const triggerReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return;
    }

    resetAudioState();

    if (retryCountRef.current >= MAX_RECONNECT_RETRIES) {
      logService.error('Max reconnection attempts reached.');
      setTranslationError('liveStatus_connection_lost_retry_failed');
      setIsReconnecting(false);
      setIsConnected(false);

      stopVideo();
      return;
    }

    setIsReconnecting(true);
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... cap at 30s
    const delay = Math.min(30000, RECONNECT_BASE_DELAY_MS * Math.pow(2, retryCountRef.current));

    const attempt = retryCountRef.current + 1;
    logService.warn(
      `Live API disconnected. Reconnecting in ${delay}ms... (Attempt ${attempt}/${MAX_RECONNECT_RETRIES})`,
    );
    setTranslationError('liveStatus_reconnecting_attempt', {
      attempt,
      maxRetries: MAX_RECONNECT_RETRIES,
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      retryCountRef.current++;
      connectRef.current();
    }, delay);
  }, [resetAudioState, setIsConnected, setIsReconnecting, stopVideo, setTranslationError]);

  const handleGoAway = useCallback(
    (goAway?: { timeLeft?: string }) => {
      if (isUserDisconnectRef.current || isProactiveReconnectRef.current || !sessionHandleRef.current) {
        return;
      }

      logService.info('Live API GoAway received', goAway ?? {});
      isProactiveReconnectRef.current = true;
      setIsReconnecting(true);
      setTranslationError('liveStatus_refreshing');

      sessionRef.current?.then((session) => session.close());
    },
    [sessionHandleRef, sessionRef, setIsReconnecting, setTranslationError],
  );

  const connect = useCallback(async (): Promise<boolean> => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setErrorState(null);
    isUserDisconnectRef.current = false;
    isConnectingRef.current = true;

    isProactiveReconnectRef.current = false;
    const shouldAbortConnect = () => isUserDisconnectRef.current || !isConnectingRef.current;

    try {
      // Specify API version v1alpha for Live API support
      const ai = await getLiveApiClient(appSettings, { apiVersion: 'v1alpha' }, liveApiKeyForConnection);
      if (shouldAbortConnect()) {
        return false;
      }

      const setupCompletePromise = new Promise<void>((resolve, reject) => {
        setupCompleteResolveRef.current = resolve;
        setupCompleteRejectRef.current = reject;
      });

      await initializeAudio((pcmData) => {
        // IMPORTANT: If connection is closed/closing, stop sending immediately to prevent WebSocket flood errors
        if (!isConnectedRef.current) return;

        const base64Data = float32ToPCM16Base64(pcmData);
        if (sessionRef.current) {
          sessionRef.current.then((session) => {
            try {
              session.sendRealtimeInput({
                audio: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Data,
                },
              });
            } catch (e) {
              // Catch synchronous send errors (e.g. if socket closed between checks)
              logService.warn('Failed to send audio frame:', e);
            }
          });
        }
      });
      if (shouldAbortConnect()) {
        resetAudioState();
        return false;
      }

      const sessionPromise = ai.live.connect({
        model: modelId,
        config: liveConfig as Parameters<typeof ai.live.connect>[0]['config'],
        callbacks: {
          onopen: () => {
            logService.info('Live API Connected', { tools: tools?.length ?? 0, resumed: !!sessionHandleRef.current });
          },
          onmessage: (msg) => {
            if (msg.setupComplete) {
              setIsConnected(true);
              setIsReconnecting(false);
              setErrorState(null);
              retryCountRef.current = 0;
              resolveSetupComplete();
            }
            handleMessage(msg);
          },
          onclose: (e) => {
            logService.info('Live API Closed', e);
            sessionRef.current = null;
            rejectSetupComplete(new Error('Live API connection closed before setup completed.'));

            setIsConnected(false);

            if (onTranscript) {
              onTranscript('', 'user', true);
              onTranscript('', 'model', true);
            }

            if (!isUserDisconnectRef.current) {
              if (isProactiveReconnectRef.current) {
                isProactiveReconnectRef.current = false;
                resetAudioState();
                void connectRef.current();
              } else {
                triggerReconnect();
              }
            } else {
              if (onClose) onClose();
            }
          },
          onerror: (err) => {
            logService.error('Live API Error', err);
            sessionRef.current = null;
            rejectSetupComplete(err instanceof Error ? err : new Error('Connection error'));

            setIsConnected(false);

            if (onTranscript) {
              onTranscript('', 'user', true);
              onTranscript('', 'model', true);
            }

            if (!isUserDisconnectRef.current) {
              triggerReconnect();
            } else {
              if (err.message) {
                setRawError(err.message);
              } else {
                setTranslationError('liveStatus_connection_error');
              }
            }
          },
        },
      });

      sessionRef.current = sessionPromise;
      const session = await sessionPromise;
      if (shouldAbortConnect()) {
        if (sessionRef.current === sessionPromise) {
          session.close();
          sessionRef.current = null;
        }
        return false;
      }

      await setupCompletePromise;
      if (shouldAbortConnect()) {
        if (sessionRef.current === sessionPromise) {
          session.close();
          sessionRef.current = null;
        }
        return false;
      }

      isConnectingRef.current = false;
      return true;
    } catch (err) {
      const wasUserDisconnect = isUserDisconnectRef.current || !isConnectingRef.current;
      isConnectingRef.current = false;
      clearSetupCompleteWaiters();

      setIsConnected(false);
      if (wasUserDisconnect) {
        setIsReconnecting(false);
        return false;
      }

      logService.error('Failed to connect to Live API', err);

      if (
        err instanceof LiveApiAuthConfigurationError ||
        (err instanceof Error && err.name === 'LiveApiAuthConfigurationError')
      ) {
        setIsReconnecting(false);
        const authError = err as LiveApiAuthConfigurationError & { code?: string };
        if (authError.code === 'MISSING_API_KEY') {
          setTranslationError('liveStatus_missing_api_key');
        } else if (err.message) {
          setRawError(err.message);
        } else {
          setTranslationError('liveStatus_failed_to_start');
        }
        resetAudioState();
        stopVideo();
        return false;
      }

      if (!isUserDisconnectRef.current) {
        triggerReconnect();
      } else {
        if (err instanceof Error && err.message) {
          setRawError(err.message);
        } else {
          setTranslationError('liveStatus_failed_to_start');
        }
        resetAudioState();
      }
      return false;
    }
  }, [
    appSettings,
    modelId,
    onClose,
    onTranscript,
    initializeAudio,
    resetAudioState,
    stopVideo,
    triggerReconnect,
    liveConfig,
    liveApiKeyForConnection,
    tools,
    handleMessage,
    sessionRef,
    sessionHandleRef,
    setIsConnected,
    setIsReconnecting,
    resolveSetupComplete,
    rejectSetupComplete,
    clearSetupCompleteWaiters,
    isConnectedRef,
    setRawError,
    setTranslationError,
  ]);

  const sendText = useCallback(
    async (text: string): Promise<boolean> => {
      if (!sessionRef.current || !isConnectedRef.current) return false;
      try {
        const session = await sessionRef.current;
        if (!isConnectedRef.current) return false;
        session.sendRealtimeInput({ text });
        logService.info('Sent text to Live API', { textLength: text.length });
        return true;
      } catch (e) {
        logService.error('Failed to send text to Live API', e);
        return false;
      }
    },
    [isConnectedRef, sessionRef],
  );

  const sendContent = useCallback(
    async (parts: Part[]): Promise<boolean> => {
      if (!sessionRef.current || !isConnectedRef.current || parts.length === 0) return false;
      try {
        const session = await sessionRef.current;
        if (!isConnectedRef.current) return false;
        session.sendClientContent({
          turns: {
            role: 'user',
            parts,
          },
          turnComplete: true,
        });
        logService.info('Sent client content to Live API', { partCount: parts.length });
        return true;
      } catch (e) {
        logService.error('Failed to send client content to Live API', e);
        return false;
      }
    },
    [isConnectedRef, sessionRef],
  );

  const disconnect = useCallback(() => {
    isUserDisconnectRef.current = true;
    isConnectingRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    rejectSetupComplete(new Error('Live API connection closed before setup completed.'));

    if (sessionRef.current) {
      sessionRef.current.then((session) => session.close()).catch(() => undefined);
    }
    sessionRef.current = null;

    resetAudioState();
    stopVideo();

    setIsConnected(false);
    setIsReconnecting(false);
    setErrorState(null);
    // Manual disconnects should not resume the previous Live API session handle.
    setSessionHandle(null);
    sessionHandleRef.current = null;

    if (onClose) onClose();
  }, [
    onClose,
    resetAudioState,
    stopVideo,
    sessionRef,
    setIsConnected,
    setIsReconnecting,
    setSessionHandle,
    sessionHandleRef,
    rejectSetupComplete,
  ]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  useEffect(() => {
    return () => {
      isUserDisconnectRef.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Unmount cleanup needs the latest connection flags from stable refs.
      if (isConnectedRef.current || isReconnectingRef.current || isConnectingRef.current) {
        disconnectRef.current();
      }
    };
  }, [isConnectedRef, isReconnectingRef]);

  return {
    isConnected,
    isReconnecting,
    errorState,
    connect,
    handleGoAway,
    disconnect,
    sendText,
    sendContent,
  };
};
