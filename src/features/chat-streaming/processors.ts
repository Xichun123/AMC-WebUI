import { type ChatMessage, type ChatSettings } from '@/types';
import type { UsageMetadata } from '@google/genai';
import { getTranslator } from '@/i18n/translations';
import { calculateTokenStats } from '@/utils/modelUsageStats';

interface FinalizeMessagesOptions {
  messages: ChatMessage[];
  generationStartTime: Date;
  newModelMessageIds: Set<string>;
  currentChatSettings: ChatSettings;
  language: 'en' | 'zh';
  firstContentPartTime: Date | null;
  usageMetadata?: UsageMetadata;
  groundingMetadata?: unknown;
  urlContextMetadata?: unknown;
  isAborted?: boolean;
}

export const finalizeMessages = ({
  messages,
  generationStartTime,
  newModelMessageIds,
  currentChatSettings: _currentChatSettings,
  language,
  firstContentPartTime,
  usageMetadata,
  groundingMetadata,
  urlContextMetadata,
  isAborted,
}: FinalizeMessagesOptions): {
  updatedMessages: ChatMessage[];
  completedMessageForNotification: ChatMessage | null;
} => {
  const t = getTranslator(language);
  let cumulativeTotal =
    [...messages]
      .reverse()
      .find(
        (message) => message.cumulativeTotalTokens !== undefined && message.generationStartTime !== generationStartTime,
      )?.cumulativeTotalTokens || 0;

  let completedMessageForNotification: ChatMessage | null = null;

  let finalMessages = messages.map((message) => {
    if (
      message.generationStartTime &&
      message.generationStartTime.getTime() === generationStartTime.getTime() &&
      message.isLoading
    ) {
      let thinkingTime = message.thinkingTimeMs;
      if (thinkingTime === undefined && firstContentPartTime) {
        thinkingTime = firstContentPartTime.getTime() - generationStartTime.getTime();
      }
      const isLastMessageOfRun = message.id === Array.from(newModelMessageIds).pop();

      const { promptTokens, cachedPromptTokens, completionTokens, totalTokens, thoughtTokens, toolUsePromptTokens } =
        calculateTokenStats(isLastMessageOfRun ? usageMetadata : undefined);

      if (isLastMessageOfRun) {
        cumulativeTotal += totalTokens;
      }

      const completedMessage = {
        ...message,
        isLoading: false,
        content: message.content,
        thoughts: message.thoughts,
        generationEndTime: new Date(),
        thinkingTimeMs: thinkingTime,
        groundingMetadata: isLastMessageOfRun ? groundingMetadata : undefined,
        urlContextMetadata: isLastMessageOfRun ? urlContextMetadata : undefined,
        promptTokens: isLastMessageOfRun ? promptTokens : undefined,
        cachedPromptTokens: isLastMessageOfRun ? cachedPromptTokens : undefined,
        completionTokens: isLastMessageOfRun ? completionTokens : undefined,
        toolUsePromptTokens: isLastMessageOfRun ? toolUsePromptTokens : undefined,
        totalTokens: isLastMessageOfRun ? totalTokens : undefined,
        thoughtTokens: isLastMessageOfRun ? thoughtTokens : undefined,
        cumulativeTotalTokens: isLastMessageOfRun ? cumulativeTotal : undefined,
      };

      const isEmpty =
        !completedMessage.content?.trim() &&
        !completedMessage.files?.length &&
        !completedMessage.audioSrc &&
        !completedMessage.thoughts?.trim();

      if (isEmpty && !isAborted) {
        completedMessage.role = 'error';
        completedMessage.content = t('empty_response_error');
      }

      if (isLastMessageOfRun) {
        completedMessageForNotification = completedMessage;
      }
      return completedMessage;
    }
    return message;
  });

  if (!isAborted) {
    finalMessages = finalMessages.filter(
      (message) =>
        message.role !== 'model' ||
        message.isInternalToolMessage ||
        (message.apiParts && message.apiParts.length > 0) ||
        message.content?.trim() !== '' ||
        (message.files && message.files.length > 0) ||
        message.audioSrc ||
        (message.thoughts && message.thoughts.trim() !== ''),
    );
  }

  return { updatedMessages: finalMessages, completedMessageForNotification };
};
