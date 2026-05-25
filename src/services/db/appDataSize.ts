import { DB_STORE_NAMES } from './dbSchema';
import { getDb } from './indexedDbAccess';

const utf8Encoder = new TextEncoder();

export interface AppDataSizeEstimate {
  totalBytes: number;
  indexedDbBytes: number;
  localStorageBytes: number;
}

const estimateUtf8Bytes = (value: string): number => utf8Encoder.encode(value).length;

const estimateStoredValueBytes = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (value instanceof Blob) {
    return value.size + estimateUtf8Bytes(value.type);
  }

  if (value instanceof Date) {
    return estimateUtf8Bytes(value.toISOString());
  }

  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }

  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + estimateStoredValueBytes(item), 0);
  }

  switch (typeof value) {
    case 'string':
      return estimateUtf8Bytes(value);
    case 'number':
    case 'boolean':
    case 'bigint':
      return estimateUtf8Bytes(String(value));
    case 'object':
      return Object.entries(value).reduce(
        (total, [key, entryValue]) => total + estimateUtf8Bytes(key) + estimateStoredValueBytes(entryValue),
        0,
      );
    default:
      return 0;
  }
};

const estimateLocalStorageBytes = (): number => {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  let total = 0;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === null) {
      continue;
    }

    total += estimateUtf8Bytes(key);
    total += estimateUtf8Bytes(localStorage.getItem(key) ?? '');
  }

  return total;
};

const estimateStoreBytes = async (db: IDBDatabase, storeName: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.openCursor();
    let total = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;

      if (!cursor) {
        resolve(total);
        return;
      }

      total += estimateStoredValueBytes(cursor.primaryKey);
      total += estimateStoredValueBytes(cursor.value);
      cursor.continue();
    };

    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export const estimateAppDataSize = async (): Promise<AppDataSizeEstimate> => {
  const db = await getDb();
  const indexedDbBytes = (
    await Promise.all(DB_STORE_NAMES.map((storeName) => estimateStoreBytes(db, storeName)))
  ).reduce((total, storeBytes) => total + storeBytes, 0);
  const localStorageBytes = estimateLocalStorageBytes();

  return {
    totalBytes: indexedDbBytes + localStorageBytes,
    indexedDbBytes,
    localStorageBytes,
  };
};
