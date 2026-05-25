import { API_USAGE_STORE } from './dbSchema';
import { getDb, transactionToPromise, withWriteLock } from './indexedDbAccess';

export interface ApiUsageRecord {
  id?: number;
  timestamp: number;
  modelId: string;
  promptTokens: number;
  cachedPromptTokens?: number;
  completionTokens: number;
  thoughtTokens?: number;
  toolUsePromptTokens?: number;
  totalTokens?: number;
  exactPricing?: ApiUsageExactPricing;
}

export type ApiUsageRequestKind = 'chat' | 'tts' | 'transcription' | 'image_generate';
export type ApiUsageModality = 'TEXT' | 'IMAGE' | 'AUDIO';

export interface ApiUsageModalityTokenCount {
  modality: ApiUsageModality;
  tokenCount: number;
}

export interface ApiUsageExactPricing {
  version: 1;
  requestKind: ApiUsageRequestKind;
  promptTokensDetails?: ApiUsageModalityTokenCount[];
  cacheTokensDetails?: ApiUsageModalityTokenCount[];
  responseTokensDetails?: ApiUsageModalityTokenCount[];
  toolUsePromptTokensDetails?: ApiUsageModalityTokenCount[];
  generatedImageCount?: number;
}

export const addApiUsageRecord = (record: ApiUsageRecord) =>
  withWriteLock(async () => {
    const db = await getDb();
    const tx = db.transaction(API_USAGE_STORE, 'readwrite');
    tx.objectStore(API_USAGE_STORE).add(record);
    return transactionToPromise(tx);
  });

export const getApiUsageByTimeRange = (startTime: number, endTime: number): Promise<ApiUsageRecord[]> =>
  getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(API_USAGE_STORE, 'readonly');
        const store = tx.objectStore(API_USAGE_STORE);
        const index = store.index('timestamp');
        const range = IDBKeyRange.bound(startTime, endTime);
        const request = index.getAll(range);
        request.onsuccess = () => resolve((request.result as ApiUsageRecord[]) ?? []);
        request.onerror = () => reject(request.error);
      }),
  );

export const clearApiUsage = () =>
  withWriteLock(async () => {
    const db = await getDb();
    const tx = db.transaction(API_USAGE_STORE, 'readwrite');
    tx.objectStore(API_USAGE_STORE).clear();
    return transactionToPromise(tx);
  });
