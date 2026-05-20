import type { File as GeminiFile } from '@google/genai';
import { getConfiguredApiClient, getConfiguredApiClientContext } from './apiClient';
import {
  createUploadAbortError,
  uploadGeminiFileResumable,
  type InternalGeminiApiClient,
} from './geminiResumableUpload';
import { logService } from '@/services/logService';

/**
 * Uploads a file using the Gemini resumable Files API and reports aggregate
 * progress after each completed chunk.
 */
export const uploadFileApi = async (
  apiKey: string,
  file: File,
  mimeType: string,
  displayName: string,
  signal: AbortSignal,
  onProgress?: (loaded: number, total: number) => void,
): Promise<GeminiFile> => {
  logService.info(`Uploading file (resumable): ${displayName}`, { mimeType, size: file.size });

  if (signal.aborted) {
    throw createUploadAbortError();
  }

  try {
    const { client, apiBaseUrl, proxyBaseUrl } = await getConfiguredApiClientContext(apiKey);
    const internalApiClient = (client as unknown as { apiClient: InternalGeminiApiClient }).apiClient;

    return await uploadGeminiFileResumable({
      apiClient: internalApiClient,
      apiBaseUrl,
      proxyBaseUrl,
      apiKey,
      file,
      mimeType,
      displayName,
      signal,
      onProgress,
    });
  } catch (error) {
    logService.error(`Failed to upload file "${displayName}" to Gemini API:`, error);

    if (signal.aborted) {
      throw createUploadAbortError();
    }

    throw error;
  }
};

export const getFileMetadataApi = async (apiKey: string, fileApiName: string): Promise<GeminiFile | null> => {
  if (!fileApiName || !fileApiName.startsWith('files/')) {
    logService.error(`Invalid fileApiName format: ${fileApiName}. Must start with "files/".`);
    throw new Error('Invalid file ID format. Expected "files/your_file_id".');
  }
  try {
    logService.info(`Fetching metadata for file: ${fileApiName}`);
    const ai = await getConfiguredApiClient(apiKey);
    const file = await ai.files.get({ name: fileApiName });
    return file;
  } catch (error) {
    logService.error(`Failed to get metadata for file "${fileApiName}" from Gemini API:`, error);
    if (error instanceof Error && (error.message.includes('NOT_FOUND') || error.message.includes('404'))) {
      return null;
    }
    throw error;
  }
};
