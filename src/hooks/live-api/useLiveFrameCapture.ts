import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Session as LiveSession } from '@google/genai';

interface UseLiveFrameCaptureProps {
  isConnected: boolean;
  videoStream: MediaStream | null;
  videoSource: 'camera' | 'screen' | null;
  volume: number;
  isMuted: boolean;
  captureFrame: () => string | null;
  sessionRef: MutableRefObject<Promise<LiveSession> | null>;
}

const LIVE_FRAME_CAPTURE_INTERVAL_MS = 1000;
const AUDIO_ACTIVITY_THRESHOLD = 0.01;
const AUDIO_ACTIVITY_WINDOW_MS = 2000;

export const useLiveFrameCapture = ({
  isConnected,
  videoStream,
  videoSource,
  volume,
  isMuted,
  captureFrame,
  sessionRef,
}: UseLiveFrameCaptureProps) => {
  const frameIntervalRef = useRef<number | null>(null);
  const lastAudioActivityAtRef = useRef<number>(0);

  useEffect(() => {
    if (!isMuted && volume >= AUDIO_ACTIVITY_THRESHOLD) {
      lastAudioActivityAtRef.current = Date.now();
    }
  }, [isMuted, volume]);

  // Frame Capture Loop
  useEffect(() => {
    if (!isConnected || !videoStream) {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      return;
    }

    const sendFrame = () => {
      const isScreenShare = videoSource === 'screen';
      const hasRecentAudioActivity =
        !isMuted && Date.now() - lastAudioActivityAtRef.current <= AUDIO_ACTIVITY_WINDOW_MS;

      if (!isScreenShare && !hasRecentAudioActivity) {
        return;
      }

      const base64Data = captureFrame();
      if (base64Data && sessionRef.current) {
        sessionRef.current.then((session) => {
          try {
            session.sendRealtimeInput({
              video: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            });
          } catch {
            // Ignore transient sends racing with session teardown.
          }
        });
      }
    };

    // Live API docs recommend a maximum of 1 frame per second.
    frameIntervalRef.current = window.setInterval(sendFrame, LIVE_FRAME_CAPTURE_INTERVAL_MS);

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, [isConnected, videoStream, videoSource, isMuted, captureFrame, sessionRef]);
};
