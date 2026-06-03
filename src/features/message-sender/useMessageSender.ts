import { type MutableRefObject, useCallback, useMemo } from 'react';
import {
  type AppSettings,
  type ChatMessage,
  type UploadedFile,
  type ChatSettings as IndividualChatSettings,
  type ImageOutputMode,
  type ImagePersonGeneration,
} from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { logService } from '@/services/logService';
import { formatApiKeyErrorMessage } from '@/utils/apiKeySelection';
import { isServerCodeExecutionMode } from '@/utils/codeExecution';
import { getModelCapabilities } from '@/utils/modelCapabilities';
import { isOpenAICompatibleApiActive } from '@/utils/openaiCompatibleMode';

import { ensureFilesApiReferences, formatFileReferenceErrorMessage } from './fileApiReference';
import { sendImageGenerationMessage } from './imageGenerationStrategy';
import { sendImageEditMessage } from './imageEditStrategy';
import { prepareFilesForOpenAICompatibleMode } from './openaiCompatibleFiles';
import { validateMessageBeforeSend } from './sendMessageValidation';
import { createSenderStoreActions } from './senderStoreActions';
import { sendStandardMessage } from './standardChatStrategy';
import { sendTtsMessage } from './ttsStrategy';
import { useChatStreamHandler } from './useChatStreamHandler';
import { useMessageLifecycle } from './useMessageLifecycle';
import { useModelRequestRunner } from './useModelRequestRunner';

interface MessageSenderProps {
  appSettings: AppSettings;
  currentChatSettings: IndividualChatSettings;
  messages: ChatMessage[];
  selectedFiles: UploadedFile[];
  setSelectedFiles: (files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  setAppFileError: (error: string | null) => void;
  aspectRatio: string;
  imageSize?: string;
  imageOutputMode: ImageOutputMode;
  personGeneration: ImagePersonGeneration;
  userScrolledUpRef: MutableRefObject<boolean>;
  activeSessionId: string | null;
  sessionKeyMapRef: MutableRefObject<Map<string, string>>;
  language: 'en' | 'zh';
}

export const useMessageSender = (props: MessageSenderProps) => {
  const { t } = useI18n();
  const {
    appSettings,
    currentChatSettings,
    messages,
    selectedFiles,
    setSelectedFiles,
    editingMessageId,
    setEditingMessageId,
    setAppFileError,
    aspectRatio,
    imageSize,
    imageOutputMode,
    personGeneration,
    userScrolledUpRef,
    activeSessionId,
  } = props;
  const senderStoreActions = useMemo(() => createSenderStoreActions(), []);
  const { updateAndPersistSessions, setActiveSessionId, setSessionLoading, activeJobs } = senderStoreActions;

  const translateApiKeyError = useCallback((error: string) => formatApiKeyErrorMessage(error, t), [t]);

  const { getStreamHandlers } = useChatStreamHandler({
    appSettings,
    updateAndPersistSessions,
    setSessionLoading,
    activeJobs,
  });

  const { runMessageLifecycle } = useMessageLifecycle({
    updateAndPersistSessions,
    setSessionLoading,
    activeJobs,
  });

  const { prepareModelRequest } = useModelRequestRunner({
    appSettings,
    currentChatSettings,
    updateAndPersistSessions,
    setActiveSessionId,
    translateApiKeyError,
  });

  const handleSendMessage = useCallback(
    async (overrideOptions?: {
      text?: string;
      files?: UploadedFile[];
      editingId?: string;
      isContinueMode?: boolean;
      isFastMode?: boolean;
      settingsOverride?: IndividualChatSettings;
    }) => {
      const textToUse = overrideOptions?.text ?? '';
      const filesToUse = overrideOptions?.files ?? selectedFiles;
      const effectiveEditingId = overrideOptions?.editingId ?? editingMessageId;
      const isContinueMode = overrideOptions?.isContinueMode ?? false;
      const isFastMode = overrideOptions?.isFastMode ?? false;

      const sessionToUpdate = overrideOptions?.settingsOverride ?? currentChatSettings;
      const isOpenAICompatibleMode = isOpenAICompatibleApiActive(appSettings);
      const activeModelId = isOpenAICompatibleMode ? appSettings.openaiCompatibleModelId : sessionToUpdate.modelId;
      const capabilities = getModelCapabilities(activeModelId);
      const isTtsModel = capabilities.isTtsModel;
      const isRealImagenModel = capabilities.isRealImagenModel;
      const isImageEditModel = capabilities.isFlashImageModel;
      const isGemini3Image = capabilities.isGemini3ImageModel;
      const permissions = capabilities.permissions ?? {
        canAcceptAttachments: !isRealImagenModel,
        requiresTextPrompt: isTtsModel || isRealImagenModel || isImageEditModel || isGemini3Image,
      };

      logService.info(`Sending message with model ${activeModelId}`, {
        textLength: textToUse.length,
        fileCount: filesToUse.length,
        editingId: effectiveEditingId,
        sessionId: activeSessionId,
        isContinueMode,
        isFastMode,
      });

      const isServerCodeExecutionEnabled = isServerCodeExecutionMode(sessionToUpdate);
      const validation = validateMessageBeforeSend({
        text: textToUse,
        files: filesToUse,
        permissions,
        isContinueMode,
        isServerCodeExecutionEnabled,
        isImageEditModel,
        isGemini3Image,
        activeModelId,
        t,
      });
      if (!validation.ok) {
        if (validation.fileError !== undefined) {
          setAppFileError(validation.fileError);
        }
        return;
      }

      setAppFileError(null);

      const continueTargetMessage =
        isContinueMode && effectiveEditingId ? messages.find((message) => message.id === effectiveEditingId) : null;
      const request = prepareModelRequest({
        activeModelId,
        files: filesToUse,
        keySettings: sessionToUpdate,
        generationId: continueTargetMessage ? (effectiveEditingId ?? undefined) : undefined,
        generationStartTime: continueTargetMessage?.generationStartTime,
        messages: {
          noModelSelected: t('messageSender_noModelSelected'),
          noModelTitle: t('messageSender_errorSessionTitle'),
          apiKeyTitle: t('messageSender_apiKeyErrorSessionTitle'),
        },
      });

      if (!request.ok) {
        return;
      }
      const { keyToUse, shouldLockKey, generationId, abortController: newAbortController } = request;
      const fileReferenceResult = isOpenAICompatibleMode
        ? prepareFilesForOpenAICompatibleMode(filesToUse)
        : await ensureFilesApiReferences({
            files: filesToUse,
            apiKey: keyToUse,
            abortSignal: newAbortController.signal,
            onFileUpdate: (fileId, patch) => {
              if (overrideOptions?.files !== undefined) {
                return;
              }

              setSelectedFiles((prev) => prev.map((file) => (file.id === fileId ? { ...file, ...patch } : file)));
            },
          });

      if (!fileReferenceResult.ok) {
        setAppFileError(formatFileReferenceErrorMessage(fileReferenceResult, t));
        return;
      }
      const filesReadyForSend = fileReferenceResult.files;

      if (appSettings.isAutoScrollOnSendEnabled) {
        userScrolledUpRef.current = false;
      }
      if (overrideOptions?.files === undefined) setSelectedFiles([]);

      if (isTtsModel) {
        await sendTtsMessage({
          keyToUse,
          activeSessionId,
          generationId,
          abortController: newAbortController,
          appSettings,
          currentChatSettings: sessionToUpdate,
          text: textToUse.trim(),
          shouldLockKey,
          updateAndPersistSessions,
          setActiveSessionId,
          runMessageLifecycle,
          t,
        });
        if (editingMessageId) setEditingMessageId(null);
        return;
      }

      if (isRealImagenModel) {
        await sendImageGenerationMessage({
          keyToUse,
          activeSessionId,
          generationId,
          abortController: newAbortController,
          appSettings,
          currentChatSettings: sessionToUpdate,
          text: textToUse.trim(),
          aspectRatio,
          imageSize,
          personGeneration,
          shouldLockKey,
          updateAndPersistSessions,
          setActiveSessionId,
          runMessageLifecycle,
          t,
        });
        if (editingMessageId) setEditingMessageId(null);
        return;
      }

      if (isImageEditModel || (isGemini3Image && appSettings.generateQuadImages)) {
        const editIndex = effectiveEditingId ? messages.findIndex((message) => message.id === effectiveEditingId) : -1;
        const historyMessages = editIndex !== -1 ? messages.slice(0, editIndex) : messages;
        await sendImageEditMessage({
          keyToUse,
          activeSessionId,
          messages: historyMessages,
          generationId,
          abortController: newAbortController,
          appSettings,
          currentChatSettings: sessionToUpdate,
          text: textToUse.trim(),
          files: filesReadyForSend,
          editingMessageId: effectiveEditingId,
          aspectRatio,
          imageSize,
          imageOutputMode,
          personGeneration,
          shouldLockKey,
          updateAndPersistSessions,
          setActiveSessionId,
          runMessageLifecycle,
          t,
        });
        if (editingMessageId) setEditingMessageId(null);
        return;
      }

      await sendStandardMessage({
        props: {
          ...props,
          currentChatSettings: sessionToUpdate,
          ...senderStoreActions,
        },
        getStreamHandlers,
        runMessageLifecycle,
        text: textToUse,
        files: filesReadyForSend,
        editingMessageId: effectiveEditingId,
        activeModelId,
        isContinueMode,
        isFastMode,
        request,
      });
    },
    [
      appSettings,
      currentChatSettings,
      messages,
      selectedFiles,
      setSelectedFiles,
      editingMessageId,
      setEditingMessageId,
      setAppFileError,
      aspectRatio,
      imageSize,
      imageOutputMode,
      personGeneration,
      userScrolledUpRef,
      activeSessionId,
      updateAndPersistSessions,
      setActiveSessionId,
      getStreamHandlers,
      runMessageLifecycle,
      senderStoreActions,
      props,
      prepareModelRequest,
      t,
    ],
  );

  return { handleSendMessage };
};
