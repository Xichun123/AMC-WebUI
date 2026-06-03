import { useState, useRef, useCallback } from 'react';
import { audioWorkletCode } from '@/features/audio/audioWorklet';
import { decodeBase64ToArrayBuffer, decodeAudioData } from '@/features/audio/audioProcessing';
import { logService } from '@/services/logService';
import { createManagedObjectUrl, releaseManagedObjectUrl } from '@/services/objectUrlManager';
import { useStateWithRef } from '@/hooks/useStateWithRef';

export const useLiveAudio = () => {
  const [volume, setVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted, isMutedRef] = useStateWithRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputAudioActiveRef = useRef(false);
  const outputAudioTailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOutputAudioTail = useCallback(() => {
    if (outputAudioTailTimeoutRef.current) {
      clearTimeout(outputAudioTailTimeoutRef.current);
      outputAudioTailTimeoutRef.current = null;
    }
  }, []);

  const markOutputAudioInactiveSoon = useCallback(() => {
    clearOutputAudioTail();
    outputAudioTailTimeoutRef.current = setTimeout(() => {
      outputAudioActiveRef.current = false;
      outputAudioTailTimeoutRef.current = null;
      setIsSpeaking(false);
    }, 300);
  }, [clearOutputAudioTail]);

  const initializeAudio = useCallback(
    async (onAudioData: (data: Float32Array) => void) => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      const outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;

      const inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
      inputContextRef.current = inputAudioContext;

      // Keep browser echo processing enabled so model playback is not captured as fresh user input.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current;
      });

      if (inputAudioContext.state === 'suspended') {
        await inputAudioContext.resume();
      }

      const microphoneSource = inputAudioContext.createMediaStreamSource(stream);
      inputSourceRef.current = microphoneSource;

      const blob = new Blob([audioWorkletCode], { type: 'application/javascript' });
      const blobUrl = createManagedObjectUrl(blob);

      try {
        await inputAudioContext.audioWorklet.addModule(blobUrl);
      } finally {
        releaseManagedObjectUrl(blobUrl);
      }

      const workletNode = new AudioWorkletNode(inputAudioContext, 'pcm-processor');
      processorRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (isMutedRef.current) {
          setVolume(0);
          return;
        }

        const inputSamples = event.data as Float32Array;

        if (outputAudioActiveRef.current) {
          setVolume(0);
          return;
        }

        let sum = 0;
        const sampleCount = inputSamples.length;
        const step = Math.ceil(sampleCount / 100);
        for (let i = 0; i < sampleCount; i += step) {
          sum += inputSamples[i] * inputSamples[i];
        }
        const rms = Math.sqrt(sum / (sampleCount / step));
        setVolume(rms);

        onAudioData(inputSamples);
      };

      microphoneSource.connect(workletNode);
      // AudioWorklet processors can stop if the graph has no destination.
      workletNode.connect(inputAudioContext.destination);

      return { outputAudioContext, inputAudioContext };
    },
    [isMutedRef],
  );

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks();
      const newMutedState = !isMutedRef.current;
      tracks.forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsMuted(newMutedState);
    } else {
      setIsMuted((prev) => !prev);
    }
  }, [isMutedRef, setIsMuted]);

  const playAudioChunk = useCallback(
    async (base64Audio: string) => {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      clearOutputAudioTail();
      outputAudioActiveRef.current = true;
      setIsSpeaking(true);

      try {
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);

        const arrayBuffer = decodeBase64ToArrayBuffer(base64Audio);
        const audioBuffer = await decodeAudioData(arrayBuffer, audioContext);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        source.onended = () => {
          sourcesRef.current.delete(source);
          if (sourcesRef.current.size === 0) {
            markOutputAudioInactiveSoon();
          }
        };

        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        sourcesRef.current.add(source);
      } catch (error) {
        logService.error('Failed to play audio chunk', error);
      }
    },
    [clearOutputAudioTail, markOutputAudioInactiveSoon],
  );

  const stopAudioPlayback = useCallback(() => {
    clearOutputAudioTail();
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* ignore already stopped */
      }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    outputAudioActiveRef.current = false;
    setIsSpeaking(false);
  }, [clearOutputAudioTail]);

  const cleanupAudio = useCallback(() => {
    stopAudioPlayback();
    clearOutputAudioTail();
    outputAudioActiveRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }

    setVolume(0);
    setIsMuted(false);
  }, [clearOutputAudioTail, setIsMuted, stopAudioPlayback]);

  return {
    volume,
    isSpeaking,
    isMuted,
    toggleMute,
    initializeAudio,
    playAudioChunk,
    stopAudioPlayback,
    cleanupAudio,
  };
};
