import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import type { ChatMessageListRuntimeValue } from './chatRuntimeTypes';

interface MessageListRuntimeValuesOptions {
  app: AppViewModel;
}

export const useChatMessageListRuntimeValues = ({ app }: MessageListRuntimeValuesOptions) => {
  const { chatState, sessionTitle, handleOpenSidePanel, handleSuggestionClick } = app;

  const onFollowUpSuggestionClick = useCallback(
    (text: string) => {
      handleSuggestionClick('follow-up', text);
    },
    [handleSuggestionClick],
  );

  const onFollowUpSuggestionFill = useCallback(
    (text: string) => {
      handleSuggestionClick('follow-up-fill', text);
    },
    [handleSuggestionClick],
  );

  return useMemo<ChatMessageListRuntimeValue>(
    () => ({
      sessionTitle,
      setScrollContainerRef: chatState.setScrollContainerRef,
      onEditMessage: chatState.handleEditMessage,
      onDeleteMessage: chatState.handleDeleteMessage,
      onRetryMessage: chatState.handleRetryMessage,
      onUpdateMessageFile: chatState.handleUpdateMessageFile,
      onFollowUpSuggestionClick,
      onFollowUpSuggestionFill,
      onContinueGeneration: chatState.handleContinueGeneration,
      onForkMessage: chatState.handleForkMessage,
      onQuickTTS: chatState.handleQuickTTS,
      onOpenSidePanel: handleOpenSidePanel,
    }),
    [chatState, handleOpenSidePanel, onFollowUpSuggestionClick, onFollowUpSuggestionFill, sessionTitle],
  );
};
