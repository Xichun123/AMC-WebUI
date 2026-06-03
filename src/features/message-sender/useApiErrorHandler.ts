import { useCallback } from 'react';
import { logService } from '@/services/logService';
import { type SavedChatSession } from '@/types';
import { updateMessageInSession } from '@/utils/chat/sessionMutations';
import { useI18n } from '@/contexts/I18nContext';
import { formatMessageSenderText } from './i18nFormat';

type SessionsUpdater = (updater: (prev: SavedChatSession[]) => SavedChatSession[]) => void;

export const useApiErrorHandler = (updateAndPersistSessions: SessionsUpdater) => {
  const { t } = useI18n();

  const handleApiError = useCallback(
    (
      error: unknown,
      sessionId: string,
      modelMessageId: string,
      errorPrefix?: string,
      partialContent?: string,
      partialThoughts?: string,
    ) => {
      const resolvedErrorPrefix =
        !errorPrefix || errorPrefix === 'Error' ? t('messageSender_apiErrorPrefix') : errorPrefix;
      const isAborted = error instanceof Error && (error.name === 'AbortError' || error.message === 'aborted');
      logService.error(`API Error (${resolvedErrorPrefix}) for message ${modelMessageId} in session ${sessionId}`, {
        error,
        isAborted,
      });

      if (isAborted) {
        if (partialContent !== undefined || partialThoughts !== undefined) {
          updateAndPersistSessions((previousSessions) =>
            updateMessageInSession(previousSessions, sessionId, modelMessageId, (message) => ({
              ...message,
              content: partialContent !== undefined ? partialContent : message.content,
              thoughts: partialThoughts !== undefined ? partialThoughts : message.thoughts,
              isLoading: false,
              generationEndTime: new Date(),
            })),
          );
        }
        return;
      }

      let errorMessage = t('messageSender_unknownError');
      if (error instanceof Error) {
        errorMessage =
          error.name === 'SilentError'
            ? t('messageSender_apiKeyNotConfigured')
            : formatMessageSenderText(t('messageSender_errorWithPrefix'), {
                prefix: resolvedErrorPrefix,
                message: error.message,
              });
      } else {
        errorMessage = formatMessageSenderText(t('messageSender_errorWithPrefix'), {
          prefix: resolvedErrorPrefix,
          message: String(error),
        });
      }

      updateAndPersistSessions((previousSessions) =>
        updateMessageInSession(previousSessions, sessionId, modelMessageId, (message) => ({
          ...message,
          role: 'error',
          content:
            (partialContent !== undefined ? partialContent : message.content || '').trim() + `\n\n[${errorMessage}]`,
          thoughts: partialThoughts !== undefined ? partialThoughts : message.thoughts,
          isLoading: false,
          generationEndTime: new Date(),
        })),
      );
    },
    [t, updateAndPersistSessions],
  );

  return { handleApiError };
};
