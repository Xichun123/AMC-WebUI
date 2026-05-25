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
    setSelectedFiles((prev) => [
      ...prev,
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

  // Generate a blob URL immediately for local preview, regardless of upload method
  const dataUrl = fileToBlobUrl(file);

  if (shouldUploadFile) {
    if (!keyToUse) {
      const errorMsg = t('upload_missing_api_key');
      logService.error(errorMsg);
      // Cleanup on early rejection
      releaseManagedObjectUrl(dataUrl);
      setSelectedFiles((prev) => [
        ...prev,
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

    // Initialize with 'uploading' state to show progress UI immediately
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

    // Initialize tracking for speed calculation
    uploadStatsRef.current.set(fileId, { lastLoaded: 0, lastTime: Date.now() });

    setSelectedFiles((prev) => [...prev, initialFileState]);

    const handleProgress = (loaded: number, total: number) => {
      const now = Date.now();
      const stats = uploadStatsRef.current.get(fileId);

      let speedStr = '';
      if (stats) {
        const timeDiff = now - stats.lastTime;
        // Only update speed every ~500ms to prevent flickering
        if (timeDiff > 500) {
          const bytesDiff = loaded - stats.lastLoaded;
          const speed = bytesDiff / (timeDiff / 1000); // Bytes per second
          speedStr = formatSpeed(speed);

          // Update stored stats
          uploadStatsRef.current.set(fileId, { lastLoaded: loaded, lastTime: now });
        }
      }

      const percent = Math.round((loaded / total) * 100);

      setSelectedFiles((prev) =>
        prev.map((selectedFile) => {
          if (selectedFile.id === fileId) {
            return {
              ...selectedFile,
              progress: percent,
              uploadSpeed: speedStr || selectedFile.uploadSpeed, // Keep old speed if not updated this tick
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

      setSelectedFiles((prev) =>
        prev.map((selectedFile) =>
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

      setSelectedFiles((prev) =>
        prev.map((selectedFile) =>
          selectedFile.id === fileId
            ? {
                ...selectedFile,
                isProcessing: false,
                error: errorMsg,
                uploadState: uploadStateUpdate,
                abortController: undefined,
                uploadSpeed: undefined,
                dataUrl: undefined, // Clear dataUrl so UI renders fallback icon
                rawFile: undefined, // Free memory
              }
            : selectedFile,
        ),
      );
    } finally {
      uploadStatsRef.current.delete(fileId);
    }
  } else {
    // Inline processing (Base64 or Text content)
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
    setSelectedFiles((prev) => [...prev, initialFileState]);

    setSelectedFiles((prev) =>
      prev.map((selectedFile) =>
        selectedFile.id === fileId
          ? { ...selectedFile, isProcessing: false, progress: 100, uploadState: 'active' }
          : selectedFile,
      ),
    );
  }
};
