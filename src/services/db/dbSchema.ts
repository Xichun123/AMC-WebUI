export const DB_NAME = 'AllModelChatDB';
export const DB_VERSION = 5;

export const SESSIONS_STORE = 'sessions';
export const FILES_STORE = 'files';
export const GROUPS_STORE = 'groups';
export const SCENARIOS_STORE = 'scenarios';
export const KEY_VALUE_STORE = 'keyValueStore';
export const LOGS_STORE = 'logs';
export const API_USAGE_STORE = 'api_usage';

export const DB_STORE_NAMES = [
  SESSIONS_STORE,
  FILES_STORE,
  GROUPS_STORE,
  SCENARIOS_STORE,
  KEY_VALUE_STORE,
  LOGS_STORE,
  API_USAGE_STORE,
] as const;

export const LOCK_NAME = 'all_model_chat_db_write_lock';

export const applyMigrations = (db: IDBDatabase, oldVersion: number) => {
  // Version 1: Initial schema
  if (oldVersion < 1) {
    db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
    db.createObjectStore(GROUPS_STORE, { keyPath: 'id' });
    db.createObjectStore(SCENARIOS_STORE, { keyPath: 'id' });
    db.createObjectStore(KEY_VALUE_STORE);
  }

  // Version 2: Add logs store
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains(LOGS_STORE)) {
      const logStore = db.createObjectStore(LOGS_STORE, { keyPath: 'id', autoIncrement: true });
      logStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  // Version 3: Reserved by an earlier migration without retained schema changes
  // Version 4: Add persisted session files store
  if (oldVersion < 4) {
    if (!db.objectStoreNames.contains(FILES_STORE)) {
      const fileStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
      fileStore.createIndex('sessionId', 'sessionId', { unique: false });
    }
  }

  // Version 5: Add API usage store
  if (oldVersion < 5) {
    if (!db.objectStoreNames.contains(API_USAGE_STORE)) {
      const usageStore = db.createObjectStore(API_USAGE_STORE, { keyPath: 'id', autoIncrement: true });
      usageStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
    db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(FILES_STORE)) {
    const fileStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
    fileStore.createIndex('sessionId', 'sessionId', { unique: false });
  }
  if (!db.objectStoreNames.contains(GROUPS_STORE)) {
    db.createObjectStore(GROUPS_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(SCENARIOS_STORE)) {
    db.createObjectStore(SCENARIOS_STORE, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(KEY_VALUE_STORE)) {
    db.createObjectStore(KEY_VALUE_STORE);
  }
  if (!db.objectStoreNames.contains(LOGS_STORE)) {
    const logStore = db.createObjectStore(LOGS_STORE, { keyPath: 'id', autoIncrement: true });
    logStore.createIndex('timestamp', 'timestamp', { unique: false });
  }
  if (!db.objectStoreNames.contains(API_USAGE_STORE)) {
    const usageStore = db.createObjectStore(API_USAGE_STORE, { keyPath: 'id', autoIncrement: true });
    usageStore.createIndex('timestamp', 'timestamp', { unique: false });
  }
};
