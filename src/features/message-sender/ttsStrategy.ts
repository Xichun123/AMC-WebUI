import { type AppSettings, type ChatSettings as IndividualChatSettings } from '@/types';
import { generateSpeechApi } from '@/services/api/generation/audioApi';
import { pcmBase64ToWavUrl } from '@/features/audio/audioProcessing';
import { runOptimisticMessagePipeline } from './messagePipeline';
import type { MessageSenderTranslator, SessionsUpdater } from './types';

type MessageLifecycleRunner = Parameters<typeof runOptimisticMessagePipeline>[0]['runMessageLifecycle'];

interface SendTtsMessageParams {
  keyToUse: string;
  activeSessionId: string | null;
  generationId: string;
  abortController: AbortController;
  appSettings: AppSettings;
  currentChatSettings: IndividualChatSettings;
  text: string;
  shouldLockKey?: boolean;
  updateAndPersistSessions: SessionsUpdater;
  setActiveSessionId: (id: string | null) => void;
  runMessageLifecycle: MessageLifecycleRunner;
  t: MessageSenderTranslator;
}

export const sendTtsMessage = async ({
  keyToUse,
  activeSessionId,
  generationId,
  abortController,
  appSettings,
  currentChatSettings,
  text,
  shouldLockKey,
  updateAndPersistSessions,
  setActiveSessionId,
  runMessageLifecycle,
  t,
}: SendTtsMessageParams) => {
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
    errorPrefix: t('messageSender_ttsErrorPrefix'),
    runMessageLifecycle,
    execute: async () => {
      const base64Pcm = await generateSpeechApi(
        keyToUse,
        currentChatSettings.modelId,
        text,
        currentChatSettings.ttsVoice,
        abortController.signal,
      );
      if (abortController.signal.aborted) throw new Error('aborted');
      const wavUrl = pcmBase64ToWavUrl(base64Pcm);

      return {
        patch: {
          isLoading: false,
          content: text,
          audioSrc: wavUrl,
          audioAutoplay: true,
          generationEndTime: new Date(),
        },
        feedback: {
          notification: {
            title: t('messageSender_audioReadyTitle'),
            body: t('messageSender_audioReadyBody'),
          },
        },
      };
    },
  });
};
