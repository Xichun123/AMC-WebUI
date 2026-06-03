import { useEffect, useRef } from 'react';
import { logService } from '@/services/logService';

export const useBackgroundKeepAlive = (isActive: boolean) => {
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isActive) {
      try {
        if (!workerRef.current) {
          workerRef.current = new Worker(new URL('./backgroundKeepAliveWorker.ts', import.meta.url), {
            type: 'module',
          });
          workerRef.current.onmessage = () => {
            // The message event wakes up the main thread
          };
          logService.debug('[KeepAlive] Worker started');
        }
        workerRef.current.postMessage('start');
      } catch (workerError) {
        logService.error('Failed to start KeepAlive worker', workerError);
      }

      try {
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(100, audioContext.currentTime);

            // Inaudible gain (0.0001) prevents user hearing it but tricks browser
            gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();

            audioContextRef.current = audioContext;
            logService.debug('[KeepAlive] Silent audio active');
          }
        }
        // Resume if suspended (browser policy)
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      } catch (audioError) {
        logService.error('Failed to start KeepAlive audio', audioError);
      }
    } else {
      if (workerRef.current) {
        workerRef.current.postMessage('stop');
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);
};
