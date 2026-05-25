import type { LogEntry } from '@/types/logging';
import { LOGS_STORE } from './dbSchema';
import { getDb, transactionToPromise, withWriteLock } from './indexedDbAccess';

export const addLogs = (logs: LogEntry[]) =>
  withWriteLock(async () => {
    const db = await getDb();
    const tx = db.transaction(LOGS_STORE, 'readwrite');
    const store = tx.objectStore(LOGS_STORE);
    logs.forEach((log) => store.add(log));
    return transactionToPromise(tx);
  });

export const getLogs = (limit = 500, offset = 0): Promise<LogEntry[]> =>
  getDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(LOGS_STORE, 'readonly');
        const store = tx.objectStore(LOGS_STORE);
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev');
        const results: LogEntry[] = [];
        let hasAdvanced = false;
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            resolve(results);
            return;
          }
          if (offset > 0 && !hasAdvanced) {
            hasAdvanced = true;
            cursor.advance(offset);
            return;
          }
          results.push(cursor.value);
          if (results.length < limit) cursor.continue();
          else resolve(results);
        };
        request.onerror = () => reject(request.error);
      }),
  );

export const clearLogs = () =>
  withWriteLock(async () => {
    const db = await getDb();
    const tx = db.transaction(LOGS_STORE, 'readwrite');
    tx.objectStore(LOGS_STORE).clear();
    return transactionToPromise(tx);
  });

export const pruneLogs = (olderThan: number) =>
  withWriteLock(async () => {
    const db = await getDb();
    const tx = db.transaction(LOGS_STORE, 'readwrite');
    const store = tx.objectStore(LOGS_STORE);
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(new Date(olderThan));
    const request = index.openKeyCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    return transactionToPromise(tx);
  });
