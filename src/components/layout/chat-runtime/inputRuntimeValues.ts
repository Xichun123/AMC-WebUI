import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import { useChatStore } from '@/stores/chatStore';
import type { ModelOption, UploadedFile } from '@/types';
import type { ChatInputRuntimeValue } from './chatRuntimeTypes';

interface InputRuntimeValuesOptions {
  app: AppViewModel;
  availableModels: ModelOption[];
  onOpenSettings: () => void;
  onSelectModel: (modelId: string) => void;
}

export const useChatInputRuntimeValues = ({
  app,
  availableModels,
  onOpenSettings,
  onSelectModel,
}: InputRuntimeValuesOptions) => {
  const {
    setAppSettings,
    chatState,
    pipState,
    handleLoadLiveArtifactsPromptAndSave,
    handleToggleBBoxMode,
    handleToggleGuideMode,
    handleSuggestionClick,
  } = app;

  const onMessageSent = useCallback(() => {
    useChatStore.getState().setCommandedInput(null);
  }, []);

  const onSendMessage = useCallback(
    (text: string, options?: { isFastMode?: boolean; files?: UploadedFile[] }) => {
      chatState.handleSendMessage({ text, ...options });
    },
    [chatState],
  );

  const onToggleQuadImages = useCallback(() => {
    setAppSettings((prev) => ({
      ...prev,
      generateQuadImages: !prev.generateQuadImages,
    }));
  }, [setAppSettings]);

  const onSuggestionClick = useCallback(
    (text: string) => {
      handleSuggestionClick('homepage', text);
    },
    [handleSuggestionClick],
  );

  const onOrganizeInfoClick = useCallback(
    (text: string) => {
      handleSuggestionClick('organize', text);
    },
    [handleSuggestionClick],
  );

  return useMemo<ChatInputRuntimeValue>(
    () => ({
      onMessageSent,
      onSendMessage,
      onStopGenerating: chatState.handleStopGenerating,
      onCancelEdit: chatState.handleCancelEdit,
      onProcessFiles: chatState.handleProcessAndAddFiles,
      onAddFileById: chatState.handleAddFileById,
      onCancelUpload: chatState.handleCancelFileUpload,
      onTranscribeAudio: chatState.handleTranscribeAudio,
      onClearChat: chatState.handleClearCurrentChat,
      onNewChat: chatState.startNewChat,
      onOpenSettings,
      onToggleLiveArtifactsPrompt: handleLoadLiveArtifactsPromptAndSave,
      onTogglePinCurrentSession: chatState.handleTogglePinCurrentSession,
      onRetryLastTurn: chatState.handleRetryLastTurn,
      onSelectModel,
      availableModels,
      onEditLastUserMessage: chatState.handleEditLastUserMessage,
      onTogglePip: pipState.togglePip,
      isPipActive: pipState.isPipActive,
      onToggleQuadImages,
      setCurrentChatSettings: chatState.setCurrentChatSettings,
      onSuggestionClick,
      onOrganizeInfoClick,
      onAddUserMessage: chatState.handleAddUserMessage,
      onLiveTranscript: chatState.handleLiveTranscript,
      liveClientFunctions: chatState.liveClientFunctions,
      onEditMessageContent: chatState.handleUpdateMessageContent,
      onToggleBBox: handleToggleBBoxMode,
      onToggleGuide: handleToggleGuideMode,
    }),
    [
      chatState,
      availableModels,
      handleLoadLiveArtifactsPromptAndSave,
      handleToggleBBoxMode,
      handleToggleGuideMode,
      onMessageSent,
      onOpenSettings,
      onOrganizeInfoClick,
      onSelectModel,
      onSendMessage,
      onSuggestionClick,
      onToggleQuadImages,
      pipState.isPipActive,
      pipState.togglePip,
    ],
  );
};
