import { useEffect, useRef, useState } from 'react';
import { type UploadedFile, type SavedChatSession, type ChatSettings } from '@/types';
import { logService } from '@/services/logService';
import { cleanupFilePreviewUrls } from '@/utils/filePreviewUrls';
import {
  getModelCapabilities,
  normalizeAspectRatioForModel,
  normalizeImageSizeForModel,
} from '@/utils/modelCapabilities';
import { getTranslator } from '@/i18n/translations';

interface UseChatEffectsProps {
  activeSessionId: string | null;
  savedSessions: SavedChatSession[];
  selectedFiles: UploadedFile[];
  appFileError: string | null;
  setAppFileError: React.Dispatch<React.SetStateAction<string | null>>;
  isSwitchingModel: boolean;
  setIsSwitchingModel: (value: boolean) => void;
  currentChatSettings: ChatSettings;
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  imageSize: string;
  setImageSize: (value: string) => void;
  loadInitialData: () => Promise<void>;
  loadChatSession: (id: string) => void;
  startNewChat: () => void;
}

export const useChatEffects = ({
  activeSessionId,
  savedSessions,
  selectedFiles,
  appFileError,
  setAppFileError,
  isSwitchingModel,
  setIsSwitchingModel,
  currentChatSettings,
  aspectRatio,
  setAspectRatio,
  imageSize,
  setImageSize,
  loadInitialData,
  loadChatSession,
  startNewChat,
}: UseChatEffectsProps) => {
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadInitialData();
      } finally {
        setHasLoadedInitialData(true);
      }
    };
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Load persisted chat data once on mount.

  useEffect(() => {
    if (hasLoadedInitialData && activeSessionId && !savedSessions.find((session) => session.id === activeSessionId)) {
      logService.warn(`Active session ${activeSessionId} is no longer available. Switching sessions.`);
      const sortedSessions = [...savedSessions].sort(
        (leftSession, rightSession) => rightSession.timestamp - leftSession.timestamp,
      );
      const nextSession = sortedSessions[0];
      if (nextSession) {
        loadChatSession(nextSession.id);
      } else {
        startNewChat();
      }
    }
  }, [savedSessions, activeSessionId, hasLoadedInitialData, loadChatSession, startNewChat]);

  useEffect(() => {
    const handleOnline = () => {
      setAppFileError((currentError) => {
        if (
          currentError &&
          (currentError.toLowerCase().includes('network') || currentError.toLowerCase().includes('fetch'))
        ) {
          logService.info('Network restored, clearing file processing error.');
          return null;
        }
        return currentError;
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [setAppFileError]);

  useEffect(() => {
    const isFileProcessing = selectedFiles.some((file) => file.isProcessing);
    const waitForFilesMessages = [
      getTranslator('en')('messageSender_waitForFiles'),
      getTranslator('zh')('messageSender_waitForFiles'),
    ];
    if (appFileError && waitForFilesMessages.includes(appFileError) && !isFileProcessing) {
      setAppFileError(null);
    }
  }, [selectedFiles, appFileError, setAppFileError]);

  const savedSessionsRef = useRef(savedSessions);
  useEffect(() => {
    savedSessionsRef.current = savedSessions;
  }, [savedSessions]);

  useEffect(
    () => () => {
      savedSessionsRef.current.forEach((session) => {
        session.messages.forEach((message) => {
          cleanupFilePreviewUrls(message.files);
        });
      });
    },
    [],
  );

  useEffect(() => {
    if (isSwitchingModel) {
      const timer = setTimeout(() => setIsSwitchingModel(false), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSwitchingModel, setIsSwitchingModel]);

  const prevModelIdRef = useRef(currentChatSettings.modelId);
  useEffect(() => {
    if (prevModelIdRef.current !== currentChatSettings.modelId) {
      const modelId = currentChatSettings.modelId;
      const capabilities = getModelCapabilities(modelId);
      const isBananaModel = capabilities.isFlashImageModel || capabilities.isGemini3ImageModel;

      if (capabilities.supportedAspectRatios?.length) {
        const preferredAspectRatio = isBananaModel ? 'Auto' : aspectRatio;
        const normalizedAspectRatio = normalizeAspectRatioForModel(modelId, preferredAspectRatio);

        if (normalizedAspectRatio && normalizedAspectRatio !== aspectRatio) {
          setAspectRatio(normalizedAspectRatio);
        }
      } else if (aspectRatio === 'Auto') {
        setAspectRatio('1:1');
      }

      const normalizedImageSize = normalizeImageSizeForModel(modelId, imageSize);
      if (normalizedImageSize && normalizedImageSize !== imageSize) {
        setImageSize(normalizedImageSize);
      }

      prevModelIdRef.current = modelId;
    }
  }, [currentChatSettings.modelId, aspectRatio, imageSize, setAspectRatio, setImageSize]);
};
