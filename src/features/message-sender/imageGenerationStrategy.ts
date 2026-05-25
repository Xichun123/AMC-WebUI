import { type AppSettings, type ChatSettings as IndividualChatSettings, type ImagePersonGeneration } from '@/types';
import { generateImagesApi } from '@/services/api/generation/imageApi';
import { createUploadedFileFromBase64 } from '@/utils/chat/parsing';
import { formatMessageSenderText } from './i18nFormat';
import { runOptimisticMessagePipeline } from './messagePipeline';
import type { MessageSenderTranslator, SessionsUpdater } from './types';

type MessageLifecycleRunner = Parameters<typeof runOptimisticMessagePipeline>[0]['runMessageLifecycle'];

interface SendImageGenerationMessageParams {
  keyToUse: string;
  activeSessionId: string | null;
  generationId: string;
  abortController: AbortController;
  appSettings: AppSettings;
  currentChatSettings: IndividualChatSettings;
  text: string;
  aspectRatio: string;
  imageSize: string | undefined;
  personGeneration: ImagePersonGeneration;
  shouldLockKey?: boolean;
  updateAndPersistSessions: SessionsUpdater;
  setActiveSessionId: (id: string | null) => void;
  runMessageLifecycle: MessageLifecycleRunner;
  t: MessageSenderTranslator;
}

export const sendImageGenerationMessage = async ({
  keyToUse,
  activeSessionId,
  generationId,
  abortController,
  appSettings,
  currentChatSettings,
  text,
  aspectRatio,
  imageSize,
  personGeneration,
  shouldLockKey,
  updateAndPersistSessions,
  setActiveSessionId,
  runMessageLifecycle,
  t,
}: SendImageGenerationMessageParams) => {
  await runOptimisticMessagePipeline({
    activeSessionId,
    appSettings,
    currentChatSettings,
    updateAndPersistSessions,
    setActiveSessionId,
    text,
    generationId,
    shouldLockKey,
    keyToLock: keyToUse,
    abortController,
    errorPrefix: t('messageSender_imageGenErrorPrefix'),
    runMessageLifecycle,
    execute: async () => {
      const imageBase64Array = await generateImagesApi(
        keyToUse,
        currentChatSettings.modelId,
        text,
        aspectRatio,
        imageSize,
        abortController.signal,
        {
          numberOfImages: appSettings.generateQuadImages ? 4 : 1,
          personGeneration,
        },
      );

      if (abortController.signal.aborted) throw new Error('aborted');

      const generatedFiles = imageBase64Array.map((base64Data, index) =>
        createUploadedFileFromBase64(base64Data, 'image/png', `generated-image-${index + 1}`),
      );

      return {
        patch: {
          isLoading: false,
          content: formatMessageSenderText(t('messageSender_generatedImagesForPrompt'), {
            count: generatedFiles.length,
            prompt: text,
          }),
          files: generatedFiles,
          generationEndTime: new Date(),
        },
        feedback: {
          notification: {
            title: t('messageSender_imageReadyTitle'),
            body: t('messageSender_imageReadyBody'),
          },
        },
      };
    },
  });
};
