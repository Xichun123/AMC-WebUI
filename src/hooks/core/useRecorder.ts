import { logService } from '@/services/logService';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getMixedAudioStream } from '@/features/audio/audioProcessing';
import { getTranslator } from '@/i18n/translations';

type RecorderStatus = 'idle' | 'recording' | 'paused';

interface UseRecorderOptions {
  onStop?: (blob: Blob) => void;
  onError?: (error: string) => void;
  onSystemAudioWarning?: (warning: string | null) => void;
  permissionErrorMessage?: string;
}

const RECORDING_MIME_TYPE_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const RECORDING_DURATION_TICK_MS = 1000;

const getSupportedRecordingMimeType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }

  return RECORDING_MIME_TYPE_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
};

const stopStreamTracks = (targetStream: MediaStream | null) => {
  targetStream?.getTracks().forEach((track) => track.stop());
};

export const useRecorder = (options: UseRecorderOptions = {}) => {
  const { onStop, onError, onSystemAudioWarning, permissionErrorMessage } = options;
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [isInitializing, setIsInitializing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const mixedStreamCleanupRef = useRef<(() => void) | null>(null);
  const startRequestIdRef = useRef(0);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      stopStreamTracks(streamRef.current);
      setStream(null);
      streamRef.current = null;
    }

    if (mixedStreamCleanupRef.current) {
      mixedStreamCleanupRef.current();
      mixedStreamCleanupRef.current = null;
    }

    if (micStreamRef.current) {
      stopStreamTracks(micStreamRef.current);
      micStreamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(
    async (recordingOptions?: { captureSystemAudio?: boolean }) => {
      const requestId = startRequestIdRef.current + 1;
      startRequestIdRef.current = requestId;
      setError(null);
      setIsInitializing(true);
      onSystemAudioWarning?.(null);
      cleanup();

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        if (startRequestIdRef.current !== requestId) {
          stopStreamTracks(micStream);
          return;
        }

        micStreamRef.current = micStream;

        const {
          stream: finalStream,
          cleanup: streamCleanup,
          warning: systemAudioWarning,
        } = await getMixedAudioStream(micStream, recordingOptions?.captureSystemAudio);

        if (startRequestIdRef.current !== requestId) {
          streamCleanup();
          stopStreamTracks(finalStream);
          stopStreamTracks(micStream);
          return;
        }

        onSystemAudioWarning?.(systemAudioWarning ?? null);

        mixedStreamCleanupRef.current = streamCleanup;

        setStream(finalStream);

        const supportedMimeType = getSupportedRecordingMimeType();
        const recorder = supportedMimeType
          ? new MediaRecorder(finalStream, { mimeType: supportedMimeType })
          : new MediaRecorder(finalStream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || supportedMimeType || 'audio/webm' });
          if (blob.size > 0 && onStop) {
            onStop(blob);
          }
          cleanup();
        };

        recorder.start();
        setStatus('recording');
        setDuration(0);
        timerRef.current = window.setInterval(
          () => setDuration((previousDuration) => previousDuration + 1),
          RECORDING_DURATION_TICK_MS,
        );
      } catch (recorderError) {
        logService.error('Recorder error:', recorderError);
        const errorMessage = permissionErrorMessage ?? getTranslator('en')('voiceInput_permission_error');
        setError(errorMessage);
        if (onError) onError(errorMessage);
        setStatus('idle');
        cleanup();
      } finally {
        if (startRequestIdRef.current === requestId) {
          setIsInitializing(false);
        }
      }
    },
    [onStop, onError, onSystemAudioWarning, permissionErrorMessage, cleanup],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('idle');
    }
  }, []);

  const cancelRecording = useCallback(() => {
    startRequestIdRef.current += 1;
    if (mediaRecorderRef.current) {
      // Prevent canceling from publishing the recorded chunks.
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;

      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    setStatus('idle');
    setIsInitializing(false);
    setDuration(0);
    onSystemAudioWarning?.(null);
    cleanup();
  }, [cleanup, onSystemAudioWarning]);

  return {
    status,
    isInitializing,
    duration,
    error,
    stream,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
