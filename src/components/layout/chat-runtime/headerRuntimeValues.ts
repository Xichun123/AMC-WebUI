import { useCallback, useMemo } from 'react';

import type { AppViewModel } from '@/hooks/app/useApp';
import { focusChatInput } from '@/utils/chat-input/focus';
import { isOpenAICompatibleApiActive } from '@/utils/openaiCompatibleMode';
import type { ChatHeaderRuntimeValue } from './chatRuntimeTypes';

interface HeaderRuntimeValuesOptions {
  app: AppViewModel;
  onOpenScenariosModal: () => void;
  onToggleHistorySidebar: () => void;
}

const buildHeaderModels = (
  appSettings: AppViewModel['appSettings'],
  apiModels: AppViewModel['chatState']['apiModels'],
) => {
  const seenIds = new Set<string>();
  const geminiModels = apiModels.map((model) => ({ ...model, apiMode: 'gemini-native' as const }));
  const openaiCompatibleModels =
    appSettings.isOpenAICompatibleApiEnabled === true
      ? appSettings.openaiCompatibleModels.map((model) => ({
          ...model,
          apiMode: 'openai-compatible' as const,
        }))
      : [];

  return [...geminiModels, ...openaiCompatibleModels].filter((model) => {
    if (seenIds.has(model.id)) {
      return false;
    }

    seenIds.add(model.id);
    return true;
  });
};

export const useChatHeaderRuntimeValues = ({
  app,
  onOpenScenariosModal,
  onToggleHistorySidebar,
}: HeaderRuntimeValuesOptions) => {
  const {
    appSettings,
    setAppSettings,
    chatState,
    pipState,
    handleLoadLiveArtifactsPromptAndSave,
    isLiveArtifactsPromptActive,
    isLiveArtifactsPromptBusy,
    handleSetThinkingLevel,
    getCurrentModelDisplayName,
  } = app;

  const gemmaReasoningEnabled = chatState.currentChatSettings.showThoughts;
  const onToggleGemmaReasoning = useCallback(() => {
    const nextGemmaReasoningEnabled = !gemmaReasoningEnabled;

    setAppSettings((prev) => ({
      ...prev,
      showThoughts: nextGemmaReasoningEnabled,
    }));

    chatState.setCurrentChatSettings((prev) => ({
      ...prev,
      showThoughts: nextGemmaReasoningEnabled,
    }));
  }, [chatState, gemmaReasoningEnabled, setAppSettings]);

  const currentModelName = getCurrentModelDisplayName();
  const isOpenAICompatibleMode = isOpenAICompatibleApiActive(appSettings);
  const openaiCompatibleModelIds = useMemo(
    () =>
      new Set(
        appSettings.isOpenAICompatibleApiEnabled === true
          ? appSettings.openaiCompatibleModels.map((model) => model.id)
          : [],
      ),
    [appSettings.isOpenAICompatibleApiEnabled, appSettings.openaiCompatibleModels],
  );
  const geminiModelIds = useMemo(() => new Set(chatState.apiModels.map((model) => model.id)), [chatState.apiModels]);
  const headerAvailableModels = useMemo(
    () => buildHeaderModels(appSettings, chatState.apiModels),
    [appSettings, chatState.apiModels],
  );
  const headerSelectedModelId = isOpenAICompatibleMode
    ? appSettings.openaiCompatibleModelId
    : chatState.currentChatSettings.modelId || appSettings.modelId;
  const handleHeaderSelectModel = useCallback(
    (modelId: string) => {
      const isOpenAICompatibleModel = openaiCompatibleModelIds.has(modelId);
      const isGeminiModel = geminiModelIds.has(modelId);

      if (
        appSettings.isOpenAICompatibleApiEnabled === true &&
        isOpenAICompatibleModel &&
        (!isGeminiModel || isOpenAICompatibleMode)
      ) {
        setAppSettings((prev) => ({
          ...prev,
          apiMode: 'openai-compatible',
          openaiCompatibleModelId: modelId,
        }));
        focusChatInput();
        return;
      }

      if (isOpenAICompatibleMode) {
        setAppSettings((prev) => ({
          ...prev,
          apiMode: 'gemini-native',
        }));
      }
      chatState.handleSelectModelInHeader(modelId);
    },
    [
      chatState,
      appSettings.isOpenAICompatibleApiEnabled,
      geminiModelIds,
      isOpenAICompatibleMode,
      openaiCompatibleModelIds,
      setAppSettings,
    ],
  );

  const header = useMemo<ChatHeaderRuntimeValue>(
    () => ({
      isAppDraggingOver: chatState.isAppDraggingOver,
      modelsLoadingError: chatState.modelsLoadingError,
      handleAppDragEnter: chatState.handleAppDragEnter,
      handleAppDragOver: chatState.handleAppDragOver,
      handleAppDragLeave: chatState.handleAppDragLeave,
      handleAppDrop: chatState.handleAppDrop,
      currentModelName,
      availableModels: headerAvailableModels,
      selectedModelId: headerSelectedModelId,
      isLiveArtifactsPromptActive,
      isLiveArtifactsPromptBusy: !!isLiveArtifactsPromptBusy,
      isPipSupported: pipState.isPipSupported,
      isPipActive: pipState.isPipActive,
      onNewChat: chatState.startNewChat,
      onOpenScenariosModal,
      onToggleHistorySidebar,
      onLoadLiveArtifactsPrompt: handleLoadLiveArtifactsPromptAndSave,
      onSelectModel: handleHeaderSelectModel,
      onSetThinkingLevel: handleSetThinkingLevel,
      onToggleGemmaReasoning,
      onTogglePip: pipState.togglePip,
    }),
    [
      chatState,
      currentModelName,
      handleHeaderSelectModel,
      handleLoadLiveArtifactsPromptAndSave,
      handleSetThinkingLevel,
      headerAvailableModels,
      headerSelectedModelId,
      isLiveArtifactsPromptActive,
      isLiveArtifactsPromptBusy,
      onOpenScenariosModal,
      onToggleGemmaReasoning,
      onToggleHistorySidebar,
      pipState,
    ],
  );

  return {
    header,
    headerAvailableModels,
    handleHeaderSelectModel,
  };
};
