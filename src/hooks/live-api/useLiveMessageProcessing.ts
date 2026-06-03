import { useCallback, useRef, type MutableRefObject } from 'react';
import type { LiveServerMessage, Session as LiveSession } from '@google/genai';
import { useLiveTools } from './useLiveTools';
import type { LiveClientFunctions, LiveTranscriptHandler, ThoughtSupportingPart, UploadedFile } from '@/types';
import { createWavBlobFromPCMChunks } from '@/features/audio/audioProcessing';
import { getContentDeltaFromPart } from '@/features/chat-streaming/messageStreamParts';

interface UseLiveMessageProcessingProps {
  playAudioChunk: (data: string) => Promise<void>;
  stopAudioPlayback: () => void;
  onTranscript?: LiveTranscriptHandler;
  onGoAway?: (goAway: NonNullable<LiveServerMessage['goAway']>) => void;
  onGeneratedFiles?: (files: UploadedFile[]) => void;
  clientFunctions?: LiveClientFunctions;
  sessionRef: MutableRefObject<Promise<LiveSession> | null>;
  setSessionHandle: (handle: string | null) => void;
  sessionHandleRef: MutableRefObject<string | null>;
}

export const useLiveMessageProcessing = ({
  playAudioChunk,
  stopAudioPlayback,
  onTranscript,
  onGoAway,
  onGeneratedFiles,
  clientFunctions,
  sessionRef,
  setSessionHandle,
  sessionHandleRef,
}: UseLiveMessageProcessingProps) => {
  const { handleToolCall, cancelToolCalls } = useLiveTools({ clientFunctions, sessionRef, onGeneratedFiles });

  const audioChunksRef = useRef<string[]>([]);

  const finalizeAudio = useCallback(() => {
    if (audioChunksRef.current.length > 0 && onTranscript) {
      const wavUrl = createWavBlobFromPCMChunks(audioChunksRef.current);
      if (wavUrl) {
        onTranscript('', 'model', true, 'content', wavUrl);
      }
      audioChunksRef.current = [];
    }
  }, [onTranscript]);

  const clearBufferedAudio = useCallback(() => {
    audioChunksRef.current = [];
  }, []);

  const handleMessage = useCallback(
    async (message: LiveServerMessage) => {
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          const thoughtPart = part as ThoughtSupportingPart;

          if (part.inlineData?.data) {
            audioChunksRef.current.push(part.inlineData.data);
            await playAudioChunk(part.inlineData.data);
          }

          if (thoughtPart.thought && onTranscript) {
            const thoughtText = typeof thoughtPart.thought === 'string' ? thoughtPart.thought : thoughtPart.text || '';
            if (thoughtText) {
              onTranscript(thoughtText, 'model', false, 'thought');
            }
          } else if (part.text && onTranscript) {
            onTranscript(part.text, 'model', false, 'content', undefined, undefined, part);
          }

          if (part.executableCode) {
            if (onTranscript) {
              onTranscript(getContentDeltaFromPart(part), 'model', false, 'content', undefined, undefined, part);
            }
          }
          if (part.codeExecutionResult) {
            if (onTranscript) {
              onTranscript(getContentDeltaFromPart(part), 'model', false, 'content', undefined, undefined, part);
            }
          }
        }
      }

      if (message.toolCall) {
        await handleToolCall(message.toolCall);
      }

      if (message.toolCallCancellation?.ids?.length) {
        cancelToolCalls(message.toolCallCancellation.ids);
      }

      if (message.serverContent?.interrupted) {
        stopAudioPlayback();
        finalizeAudio();
        if (onTranscript) {
          onTranscript('', 'user', true, 'content');
          onTranscript('', 'model', true, 'content');
        }
      }

      if (message.serverContent?.inputTranscription && onTranscript) {
        const text = message.serverContent.inputTranscription.text;
        if (text) {
          onTranscript(text, 'user', false, 'content');
        }
      }
      if (message.serverContent?.outputTranscription && onTranscript) {
        const text = message.serverContent.outputTranscription.text;
        if (text) {
          onTranscript(text, 'model', false, 'content');
        }
      }

      if (message.serverContent?.turnComplete) {
        finalizeAudio();
        if (onTranscript) {
          onTranscript('', 'user', true, 'content');
          onTranscript('', 'model', true, 'content');
        }
      }

      if (message.goAway) {
        onGoAway?.(message.goAway);
      }

      if (
        message.sessionResumptionUpdate &&
        message.sessionResumptionUpdate.resumable &&
        message.sessionResumptionUpdate.newHandle
      ) {
        const newHandle = message.sessionResumptionUpdate.newHandle;
        setSessionHandle(newHandle);
        sessionHandleRef.current = newHandle;
      }
    },
    [
      playAudioChunk,
      stopAudioPlayback,
      onTranscript,
      onGoAway,
      handleToolCall,
      cancelToolCalls,
      setSessionHandle,
      sessionHandleRef,
      finalizeAudio,
    ],
  );

  return { handleMessage, clearBufferedAudio };
};
