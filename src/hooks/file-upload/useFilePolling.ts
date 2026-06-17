import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { type AppSettings, type ChatSettings as IndividualChatSettings, type UploadedFile } from '@/types';
import { formatApiKeyErrorMessage, getGeminiKeyForRequest } from '@/utils/apiKeySelection';
import { logService } from '@/services/logService';
import { POLLING_INTERVAL_MS, MAX_POLLING_DURATION_MS } from '@/services/api/filePollingConfig';
import { getFileMetadataApi } from '@/services/api/fileApi';
import { useI18n } from '@/contexts/I18nContext';

const MAX_POLLING_BACKOFF_MULTIPLIER = 8;

const getFilePollingDelayMs = (failureCount: number): number => {
  const multiplier = Math.min(MAX_POLLING_BACKOFF_MULTIPLIER, Math.pow(2, Math.max(0, failureCount)));
  return POLLING_INTERVAL_MS * multiplier;
};

interface UseFilePollingProps {
  appSettings: AppSettings;
  selectedFiles: UploadedFile[];
  setSelectedFiles: Dispatch<SetStateAction<UploadedFile[]>>;
  currentChatSettings: IndividualChatSettings;
}

export const useFilePolling = ({
  appSettings,
  selectedFiles,
  setSelectedFiles,
  currentChatSettings,
}: UseFilePollingProps) => {
  const { t } = useI18n();

  // Stable refs — read inside interval closures without re-triggering the effect.
  const selectedFilesRef = useRef(selectedFiles);
  const appSettingsRef = useRef(appSettings);
  const currentChatSettingsRef = useRef(currentChatSettings);
  const tRef = useRef(t);
  const setSelectedFilesRef = useRef(setSelectedFiles);

  selectedFilesRef.current = selectedFiles;
  appSettingsRef.current = appSettings;
  currentChatSettingsRef.current = currentChatSettings;
  tRef.current = t;
  setSelectedFilesRef.current = setSelectedFiles;

  // Polling state refs — persist across re-renders (not reset on every render).
  const pollingIntervals = useRef<Map<string, number>>(new Map());
  const pollingInFlight = useRef<Set<string>>(new Set());
  const pollingFailures = useRef<Map<string, number>>(new Map());
  const lastPollingAttempt = useRef<Map<string, number>>(new Map());
  const pollingStartTimes = useRef<Map<string, number>>(new Map());

  // Derive a stable string of file IDs that need polling.
  // This is the ONLY effect dependency — progress updates, file additions, etc.
  // do NOT change this value, so the effect is not rebuilt on every state change.
  const pollingTargetIds = selectedFiles
    .filter((file) => file.uploadState === 'processing_api' && !file.error && file.fileApiName)
    .map((file) => file.id)
    .join('\n');

  useEffect(() => {
    const intervals = pollingIntervals.current;
    const inFlight = pollingInFlight.current;
    const failures = pollingFailures.current;
    const lastAttempts = lastPollingAttempt.current;
    const startTimes = pollingStartTimes.current;

    const filesCurrentlyPolling = new Set(intervals.keys());
    const filesThatShouldPoll = new Set(pollingTargetIds ? pollingTargetIds.split('\n') : []);

    // Stop polling for files that are no longer in the 'processing_api' state.
    for (const fileId of filesCurrentlyPolling) {
      if (!filesThatShouldPoll.has(fileId)) {
        window.clearInterval(intervals.get(fileId));
        intervals.delete(fileId);
        inFlight.delete(fileId);
        failures.delete(fileId);
        lastAttempts.delete(fileId);
        startTimes.delete(fileId);
        logService.info(`Stopped polling for file ${fileId} as it is no longer in a processing state.`);
      }
    }

    // Start polling for newly-eligible files.
    for (const fileId of filesThatShouldPoll) {
      if (filesCurrentlyPolling.has(fileId)) continue;

      const fileToPoll = selectedFilesRef.current.find((file) => file.id === fileId);
      if (!fileToPoll?.fileApiName) continue;

      const fileApiName = fileToPoll.fileApiName;
      const startTime = Date.now();
      startTimes.set(fileId, startTime);

      logService.info(`Starting polling for file ${fileId} (${fileApiName})`);

      const poll = async () => {
        if (inFlight.has(fileId)) {
          return;
        }

        const failureCount = failures.get(fileId) ?? 0;
        const lastAttempt = lastAttempts.get(fileId) ?? 0;
        const now = Date.now();
        if (lastAttempt > 0 && now - lastAttempt < getFilePollingDelayMs(failureCount)) {
          return;
        }

        const fileStartTime = startTimes.get(fileId) ?? startTime;
        if (now - fileStartTime > MAX_POLLING_DURATION_MS) {
          logService.error(`Polling timed out for file ${fileApiName}`);
          setSelectedFilesRef.current((prev) =>
            prev.map((selectedFile) =>
              selectedFile.id === fileId
                ? {
                    ...selectedFile,
                    error: tRef.current('fileProcessingTimedOut'),
                    uploadState: 'failed',
                    isProcessing: false,
                  }
                : selectedFile,
            ),
          );
          return;
        }

        inFlight.add(fileId);
        lastAttempts.set(fileId, now);

        // Optimize polling by not rotating keys unnecessarily.
        // We reuse the current index/key to avoid burning through rotation turns on poll ticks.
        const keyResult = getGeminiKeyForRequest(appSettingsRef.current, currentChatSettingsRef.current, {
          skipIncrement: true,
        });
        if ('error' in keyResult) {
          logService.error(`Polling for ${fileApiName} stopped: ${keyResult.error}`);
          const errorMessage = formatApiKeyErrorMessage(keyResult.error, tRef.current);
          setSelectedFilesRef.current((prev) =>
            prev.map((selectedFile) =>
              selectedFile.id === fileId
                ? { ...selectedFile, error: errorMessage, uploadState: 'failed', isProcessing: false }
                : selectedFile,
            ),
          );
          inFlight.delete(fileId);
          return;
        }

        try {
          const metadata = await getFileMetadataApi(keyResult.key, fileApiName);
          if (metadata?.state === 'ACTIVE') {
            logService.info(`File ${fileApiName} is now ACTIVE.`);
            failures.delete(fileId);
            setSelectedFilesRef.current((prev) =>
              prev.map((selectedFile) =>
                selectedFile.id === fileId
                  ? { ...selectedFile, uploadState: 'active', isProcessing: false }
                  : selectedFile,
              ),
            );
          } else if (metadata?.state === 'FAILED') {
            logService.error(`File ${fileApiName} processing FAILED on backend.`);
            failures.delete(fileId);
            setSelectedFilesRef.current((prev) =>
              prev.map((selectedFile) =>
                selectedFile.id === fileId
                  ? {
                      ...selectedFile,
                      error: tRef.current('fileProcessingBackendFailed'),
                      uploadState: 'failed',
                      isProcessing: false,
                    }
                  : selectedFile,
              ),
            );
          } else {
            failures.delete(fileId);
          }
        } catch (error) {
          const nextFailureCount = (failures.get(fileId) ?? 0) + 1;
          failures.set(fileId, nextFailureCount);
          logService.warn(`Polling for ${fileApiName} failed with a key, will retry.`, { error });
        } finally {
          inFlight.delete(fileId);
        }
      };

      const intervalId = window.setInterval(poll, POLLING_INTERVAL_MS);
      intervals.set(fileId, intervalId);
      poll(); // Run immediately once
    }
    // No cleanup here — incremental start/stop above handles file changes.
    // Full cleanup is done by the unmount-only effect below.
  }, [pollingTargetIds]);

  // Clear all polling state only when the component unmounts.
  useEffect(() => {
    const intervals = pollingIntervals.current;
    const inFlight = pollingInFlight.current;
    const failures = pollingFailures.current;
    const lastAttempts = lastPollingAttempt.current;
    const startTimes = pollingStartTimes.current;
    return () => {
      intervals.forEach((intervalId) => window.clearInterval(intervalId));
      intervals.clear();
      inFlight.clear();
      failures.clear();
      lastAttempts.clear();
      startTimes.clear();
    };
  }, []);
};
