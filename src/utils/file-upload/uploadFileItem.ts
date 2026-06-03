import type { MutableRefObject } from 'react';
import { type AppSettings, type UploadedFile, type MediaResolution } from '@/types';
import { SUPPORTED_UPLOAD_MIME_TYPES } from '@/constants/fileTypeSupport';
import { logService } from '@/services/logService';
import { releaseManagedObjectUrl } from '@/services/objectUrlManager';
import { generateUniqueId } from '@/utils/chat/ids';
import { fileToBlobUrl } from '@/utils/filePreviewUrls';
import { uploadFileApi } from '@/services/api/fileApi';
import {
  createProcessingPlaceholderFile,
  formatSpeed,
  getEffectiveMimeType,
  getUploadLifecycleForGeminiState,
  shouldUseFileApi,
} from './fileUploadPolicy';
import { getTranslator } from '@/i18n/translations';

type Translator = ReturnType<typeof getTranslator>;

const UPLOAD_SPEED_UPDATE_INTERVAL_MS = 500;
const PERCENT_MULTIPLIER = 100;

interface UploadFileItemParams {
  file: File;
  keyToUse: string | null;
  forceFileApi?: boolean;
  defaultResolution: MediaResolution | undefined;
  appSettings: AppSettings;
  setSelectedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  uploadStatsRef: MutableRefObject<Map<string, { lastLoaded: number; lastTime: number }>>;
  t?: Translator;
}

export const uploadFileItem = async ({
  file,
  keyToUse,
  forceFileApi = false,
  defaultResolution,
  appSettings,
  setSelectedFiles,
  uploadStatsRef,
  t = getTranslator('en'),
}: UploadFileItemParams) => {
  const fileId = generateUniqueId();
  const effectiveMimeType = getEffectiveMimeType(file);

  if (!SUPPORTED_UPLOAD_MIME_TYPES.includes(effectiveMimeType)) {
    logService.warn(`Unsupported file type skipped: ${file.name}`, {
      type: file.type,
      effectiveType: effectiveMimeType,
    });
    setSelectedFiles((previousFiles) => [
      ...previousFiles,
      {
        id: fileId,
        name: file.name,
        type: file.type || 'unknown',
        size: file.size,
        isProcessing: false,
        progress: 0,
        error: t('upload_unsupported_type').replace('{filename}', file.name),
        uploadState: 'failed',
      },
    ]);
    return;
  }

  const shouldUploadFile = forceFileApi || shouldUseFileApi(file, appSettings);

  const dataUrl = fileToBlobUrl(file);

  if (shouldUploadFile) {
    if (!keyToUse) {
      const errorMsg = t('upload_missing_api_key');
      logService.error(errorMsg);
      releaseManagedObjectUrl(dataUrl);
      setSelectedFiles((previousFiles) => [
        ...previousFiles,
        {
          id: fileId,
          name: file.name,
          type: effectiveMimeType,
          size: file.size,
          isProcessing: false,
          progress: 0,
          error: errorMsg,
          uploadState: 'failed',
        },
      ]);
      return;
    }
    const controller = new AbortController();

    const initialFileState: UploadedFile = createProcessingPlaceholderFile({
      id: fileId,
      name: file.name,
      type: effectiveMimeType,
      size: file.size,
      progress: 0,
      rawFile: file,
      dataUrl,
      transferStrategy: 'files-api',
      uploadState: 'uploading',
      abortController: controller,
      uploadSpeed: t('upload_starting'),
      mediaResolution: defaultResolution,
    });

    uploadStatsRef.current.set(fileId, { lastLoaded: 0, lastTime: Date.now() });

    setSelectedFiles((previousFiles) => [...previousFiles, initialFileState]);

    const handleProgress = (loaded: number, total: number) => {
      const now = Date.now();
      const stats = uploadStatsRef.current.get(fileId);

      let speedStr = '';
      if (stats) {
        const timeDiff = now - stats.lastTime;
        if (timeDiff > UPLOAD_SPEED_UPDATE_INTERVAL_MS) {
          const bytesDiff = loaded - stats.lastLoaded;
          const bytesPerSecond = bytesDiff / (timeDiff / 1000);
          speedStr = formatSpeed(bytesPerSecond);

          uploadStatsRef.current.set(fileId, { lastLoaded: loaded, lastTime: now });
        }
      }

      const progressPercent = Math.round((loaded / total) * PERCENT_MULTIPLIER);

      setSelectedFiles((previousFiles) =>
        previousFiles.map((selectedFile) => {
          if (selectedFile.id === fileId) {
            return {
              ...selectedFile,
              progress: progressPercent,
              uploadSpeed: speedStr || selectedFile.uploadSpeed,
            };
          }
          return selectedFile;
        }),
      );
    };

    try {
      const uploadedFileInfo = await uploadFileApi(
        keyToUse,
        file,
        effectiveMimeType,
        file.name,
        controller.signal,
        handleProgress,
      );

      logService.info(`File uploaded, initial state: ${uploadedFileInfo.state}`, { fileInfo: uploadedFileInfo });

      const { uploadState, isProcessing } = getUploadLifecycleForGeminiState(uploadedFileInfo.state);

      setSelectedFiles((previousFiles) =>
        previousFiles.map((selectedFile) =>
          selectedFile.id === fileId
            ? {
                ...selectedFile,
                isProcessing,
                progress: 100,
                fileUri: uploadedFileInfo.uri,
                fileApiName: uploadedFileInfo.name,
                rawFile: file,
                transferStrategy: 'files-api',
                uploadState,
                error: uploadState === 'failed' ? t('upload_api_processing_failed') : selectedFile.error || undefined,
                abortController: undefined,
                uploadSpeed: undefined,
              }
            : selectedFile,
        ),
      );
    } catch (uploadError) {
      let errorMsg = t('upload_failed_with_message').replace(
        '{message}',
        uploadError instanceof Error ? uploadError.message : String(uploadError),
      );
      let uploadStateUpdate: UploadedFile['uploadState'] = 'failed';

      if (uploadError instanceof Error && uploadError.name === 'AbortError') {
        errorMsg = t('upload_cancelled_by_user');
        uploadStateUpdate = 'cancelled';
        logService.warn(`File upload cancelled by user: ${file.name}`);
      } else {
        logService.error(`File upload failed for ${file.name}`, { error: uploadError });
      }

      releaseManagedObjectUrl(dataUrl);

      setSelectedFiles((previousFiles) =>
        previousFiles.map((selectedFile) =>
          selectedFile.id === fileId
            ? {
                ...selectedFile,
                isProcessing: false,
                error: errorMsg,
                uploadState: uploadStateUpdate,
                abortController: undefined,
                uploadSpeed: undefined,
                dataUrl: undefined,
                rawFile: undefined,
              }
            : selectedFile,
        ),
      );
    } finally {
      uploadStatsRef.current.delete(fileId);
    }
  } else {
    const initialFileState: UploadedFile = createProcessingPlaceholderFile({
      id: fileId,
      name: file.name,
      type: effectiveMimeType,
      size: file.size,
      progress: 0,
      rawFile: file,
      dataUrl,
      transferStrategy: 'inline',
      mediaResolution: defaultResolution,
    });
    setSelectedFiles((previousFiles) => [...previousFiles, initialFileState]);

    setSelectedFiles((previousFiles) =>
      previousFiles.map((selectedFile) =>
        selectedFile.id === fileId
          ? { ...selectedFile, isProcessing: false, progress: 100, uploadState: 'active' }
          : selectedFile,
      ),
    );
  }
};
