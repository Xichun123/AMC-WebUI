import { type MutableRefObject, useCallback } from 'react';
import {
  type AppSettings,
  type SavedChatSession,
  type ChatSettings as IndividualChatSettings,
  type UploadedFile,
} from '@/types';
import type { Part, UsageMetadata } from '@google/genai';
import { useApiErrorHandler } from './useApiErrorHandler';
import { logService } from '@/services/logService';
import { calculateTokenStats } from '@/utils/modelUsageStats';
import { finalizeMessages } from '@/features/chat-streaming/processors';
import { streamingStore } from '@/services/streamingStore';
import { buildExactPricingFromUsageMetadata } from '@/utils/usagePricingTelemetry';
import { resolveChatExactPricing } from '@/utils/chatPricingEvidence';
import { updateMessageInSession, updateSessionById } from '@/utils/chat/sessionMutations';
import { createMessageStreamState, reduceMessageStreamEvent } from '@/features/chat-streaming/messageStreamReducer';
import { getContentDeltaFromPart, mergeUniqueFiles } from '@/features/chat-streaming/messageStreamParts';
import { finishActiveGenerationJob } from './activeGenerationJobs';
import { buildCompletionNotificationBody, emitCompletionFeedback } from './completionFeedback';

type SessionsUpdater = (
  updater: (prev: SavedChatSession[]) => SavedChatSession[],
  options?: { persist?: boolean },
) => void;

interface ChatStreamHandlerProps {
  appSettings: AppSettings;
  updateAndPersistSessions: SessionsUpdater;
  setSessionLoading: (sessionId: string, isLoading: boolean) => void;
  activeJobs: MutableRefObject<Map<string, AbortController>>;
}

export const useChatStreamHandler = ({
  appSettings,
  updateAndPersistSessions,
  setSessionLoading,
  activeJobs,
}: ChatStreamHandlerProps) => {
  const { handleApiError } = useApiErrorHandler(updateAndPersistSessions);

  const getStreamHandlers = useCallback(
    (
      currentSessionId: string,
      generationId: string,
      abortController: AbortController,
      generationStartTime: Date,
      currentChatSettings: IndividualChatSettings,
      requestParts: Part[] = [],
      onSuccess?: (generationId: string, finalContent: string) => void,
      transformFinalContent?: (finalContent: string) => string,
    ) => {
      const newModelMessageIds = new Set<string>([generationId]);
      let streamState = createMessageStreamState({ generationId, generationStartTime });

      // Reset store for this new generation
      streamingStore.clear(generationId);

      const syncFirstTokenTime = (previousFirstTokenTimeMs?: number) => {
        if (previousFirstTokenTimeMs === undefined && streamState.firstTokenTimeMs !== undefined) {
          updateAndPersistSessions(
            (prev) =>
              updateMessageInSession(prev, currentSessionId, generationId, {
                firstTokenTimeMs: streamState.firstTokenTimeMs,
              }),
            { persist: false },
          );
        }
      };

      const streamOnError = (error: Error) => {
        // Pass accumulated content so it can be saved even on error/abort
        handleApiError(error, currentSessionId, generationId, 'Error', streamState.content, streamState.thoughts);
        finishActiveGenerationJob({
          activeJobs,
          setSessionLoading,
          sessionId: currentSessionId,
          generationId,
        });
        streamingStore.clear(generationId);
      };

      const streamOnComplete = (
        usageMetadata?: UsageMetadata,
        groundingMetadata?: unknown,
        urlContextMetadata?: unknown,
        generatedFiles?: UploadedFile[],
      ) => {
        const lang =
          appSettings.language === 'system'
            ? navigator.language.toLowerCase().startsWith('zh')
              ? 'zh'
              : 'en'
            : appSettings.language;

        streamState = reduceMessageStreamEvent(streamState, {
          type: 'complete',
          usage: usageMetadata,
          grounding: groundingMetadata,
          urlContext: urlContextMetadata,
          generatedFiles,
          aborted: abortController.signal.aborted,
        });

        if (appSettings.isStreamingEnabled && !streamState.firstContentPartTime) {
          streamState = {
            ...streamState,
            firstContentPartTime: new Date(),
          };
        }

        if (transformFinalContent) {
          streamState = {
            ...streamState,
            content: transformFinalContent(streamState.content),
          };
        }

        if (streamState.usage) {
          const {
            promptTokens,
            cachedPromptTokens,
            completionTokens,
            thoughtTokens,
            toolUsePromptTokens,
            totalTokens,
          } = calculateTokenStats(streamState.usage);
          const exactPricing = resolveChatExactPricing({
            providerExactPricing: buildExactPricingFromUsageMetadata('chat', streamState.usage),
            requestParts,
            responseParts: streamState.apiParts,
            promptTokens,
            cachedPromptTokens,
            toolUsePromptTokens,
            outputTokens: completionTokens + thoughtTokens,
          });
          logService.recordTokenUsage(
            currentChatSettings.modelId,
            {
              promptTokens,
              cachedPromptTokens,
              completionTokens,
              thoughtTokens,
              toolUsePromptTokens,
              totalTokens,
            },
            exactPricing,
          );
        }

        // Perform the Final Update to State (and DB)
        updateAndPersistSessions(
          (prev) =>
            updateSessionById(prev, currentSessionId, (sessionToUpdate) => {
              const updatedMessages = sessionToUpdate.messages.map((msg) => {
                if (msg.id === generationId) {
                  return {
                    ...msg,
                    content: (msg.content || '') + streamState.content,
                    thoughts: (msg.thoughts || '') + streamState.thoughts,
                    files: streamState.files.length ? mergeUniqueFiles(msg.files, streamState.files) : msg.files,
                    apiParts: msg.apiParts ? [...msg.apiParts, ...streamState.apiParts] : streamState.apiParts,
                  };
                }
                return msg;
              });

              // Finalize (mark loading false, set stats)
              const finalizationResult = finalizeMessages({
                messages: updatedMessages,
                generationStartTime,
                newModelMessageIds,
                currentChatSettings,
                language: lang,
                firstContentPartTime: streamState.firstContentPartTime,
                usageMetadata: streamState.usage,
                groundingMetadata: streamState.grounding,
                urlContextMetadata: streamState.urlContext,
                isAborted: abortController.signal.aborted,
              });

              if (finalizationResult.completedMessageForNotification) {
                void emitCompletionFeedback(
                  {
                    isCompletionNotificationEnabled: appSettings.isCompletionNotificationEnabled,
                    isCompletionSoundEnabled: appSettings.isCompletionSoundEnabled,
                  },
                  {
                    notification: {
                      title: 'Response Ready',
                      body: buildCompletionNotificationBody(finalizationResult.completedMessageForNotification),
                    },
                  },
                );
              }

              return {
                ...sessionToUpdate,
                messages: finalizationResult.updatedMessages,
              };
            }),
          { persist: true },
        );

        finishActiveGenerationJob({
          activeJobs,
          setSessionLoading,
          sessionId: currentSessionId,
          generationId,
        });
        streamingStore.clear(generationId);

        if (onSuccess && !abortController.signal.aborted) {
          setTimeout(() => onSuccess(generationId, streamState.content), 0);
        }
      };

      const streamOnPart = (part: Part) => {
        const previousFirstTokenTimeMs = streamState.firstTokenTimeMs;
        const previousFiles = streamState.files;
        const contentDelta = getContentDeltaFromPart(part);

        streamState = reduceMessageStreamEvent(streamState, {
          type: 'part',
          part,
          receivedAt: new Date(),
        });
        syncFirstTokenTime(previousFirstTokenTimeMs);

        if (contentDelta) {
          streamingStore.updateContent(generationId, contentDelta);
        }

        const newFiles = streamState.files.filter((file) => !previousFiles.some((existing) => existing.id === file.id));
        if (newFiles.length > 0) {
          updateAndPersistSessions(
            (prev) =>
              updateMessageInSession(prev, currentSessionId, generationId, (message) => ({
                ...message,
                files: mergeUniqueFiles(message.files, newFiles),
              })),
            { persist: false },
          );
        }
      };

      const onThoughtChunk = (thoughtChunk: string) => {
        const previousFirstTokenTimeMs = streamState.firstTokenTimeMs;
        streamState = reduceMessageStreamEvent(streamState, {
          type: 'thought',
          text: thoughtChunk,
          receivedAt: new Date(),
        });
        syncFirstTokenTime(previousFirstTokenTimeMs);
        streamingStore.updateThoughts(generationId, thoughtChunk);
      };

      return { streamOnError, streamOnComplete, streamOnPart, onThoughtChunk };
    },
    [
      appSettings.isStreamingEnabled,
      appSettings.isCompletionNotificationEnabled,
      appSettings.isCompletionSoundEnabled,
      appSettings.language,
      updateAndPersistSessions,
      handleApiError,
      setSessionLoading,
      activeJobs,
    ],
  );

  return { getStreamHandlers };
};
