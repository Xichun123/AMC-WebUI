import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecorder } from '@/hooks/core/useRecorder';
import { createManagedObjectUrl, releaseManagedObjectUrl } from '@/services/objectUrlManager';

export type RecorderState = 'idle' | 'recording' | 'review';

export const useAudioRecorder = () => {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [systemAudioWarning, setSystemAudioWarning] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const replaceAudioUrl = useCallback((nextAudioUrl: string | null) => {
    const previousAudioUrl = audioUrlRef.current;

    if (previousAudioUrl && previousAudioUrl !== nextAudioUrl) {
      releaseManagedObjectUrl(previousAudioUrl);
    }

    audioUrlRef.current = nextAudioUrl;
    setAudioUrl(nextAudioUrl);
  }, []);

  useEffect(
    () => () => {
      releaseManagedObjectUrl(audioUrlRef.current);
      audioUrlRef.current = null;
    },
    [],
  );

  const resetPreview = useCallback(() => {
    setAudioBlob(null);
    replaceAudioUrl(null);
  }, [replaceAudioUrl]);

  const handleRecordingComplete = useCallback(
    (blob: Blob) => {
      const nextAudioUrl = createManagedObjectUrl(blob);
      setAudioBlob(blob);
      replaceAudioUrl(nextAudioUrl);
    },
    [replaceAudioUrl],
  );

  const {
    status,
    isInitializing,
    duration,
    error,
    stream,
    startRecording: startCore,
    stopRecording,
    cancelRecording: cancelCore,
  } = useRecorder({
    onStop: handleRecordingComplete,
    onError: resetPreview,
    onSystemAudioWarning: setSystemAudioWarning,
  });

  const startRecording = useCallback(
    (opts?: { captureSystemAudio?: boolean }) => {
      startCore(opts);
    },
    [startCore],
  );

  const discardRecording = useCallback(() => {
    resetPreview();
    cancelCore(); // Ensures stream is closed if in weird state
  }, [cancelCore, resetPreview]);

  const viewState: RecorderState = audioBlob ? 'review' : status === 'recording' ? 'recording' : 'idle';

  return {
    viewState,
    isInitializing,
    recordingTime: duration,
    audioBlob,
    audioUrl,
    error,
    systemAudioWarning,
    stream,
    status,
    startRecording,
    stopRecording,
    discardRecording,
  };
};
