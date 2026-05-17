import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { GcsConfig } from './config.js';

const AISTUDIO_FILE_URI_HOST = 'https://generativelanguage.googleapis.com';
const FILE_ID_PATTERN = /^[\w-]+$/;
const AISTUDIO_FILE_URI_PATTERN = /https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/([\w-]+)/g;
const FILE_EXPIRATION_LEEWAY_MS = 365 * 24 * 60 * 60 * 1000;

export interface StorageFile {
  save(
    data: Buffer,
    options: {
      contentType?: string;
      metadata?: { contentType?: string; metadata?: Record<string, string> };
    },
  ): Promise<unknown>;
  getMetadata(): Promise<
    [
      {
        size?: string | number;
        contentType?: string;
        metadata?: Record<string, string>;
        timeCreated?: string;
        updated?: string;
      },
    ]
  >;
  exists(): Promise<[boolean]>;
}

export interface StorageBucket {
  file(path: string): StorageFile;
}

export interface StorageLike {
  bucket(name: string): StorageBucket;
}

export interface AiStudioFile {
  name: string;
  displayName?: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime: string;
  state: 'ACTIVE';
  uri: string;
}

interface InitiateUploadInput {
  displayName: string;
  mimeType: string;
  sizeBytes: number;
}

interface InitiateUploadResult {
  sessionId: string;
  uploadUrl: string;
}

interface UploadChunkInput {
  sessionId: string;
  offset: number;
  command: string;
  chunk: Buffer;
}

interface UploadChunkResult {
  status: 'active' | 'final';
  file?: AiStudioFile;
}

interface UploadSessionState {
  id: string;
  displayName: string;
  mimeType: string;
  totalSize: number;
  receivedBytes: number;
  chunks: Buffer[];
}

interface CreateGcsFilesAdapterOptions {
  storage: StorageLike;
  config: GcsConfig;
  now?: () => Date;
  randomId?: () => string;
}

export interface GcsFilesAdapter {
  initiateUpload(input: InitiateUploadInput): InitiateUploadResult;
  uploadChunk(input: UploadChunkInput): Promise<UploadChunkResult>;
  getFileMetadata(fileId: string): Promise<AiStudioFile | null>;
  rewriteFileUriInJsonBody(body: Buffer): Buffer;
  buildGcsUriForFileId(fileId: string): string;
}

function buildAiStudioFileUri(fileId: string): string {
  return `${AISTUDIO_FILE_URI_HOST}/v1beta/files/${fileId}`;
}

function buildAiStudioFileName(fileId: string): string {
  return `files/${fileId}`;
}

function buildChunkUploadUrl(sessionId: string): string {
  return `${AISTUDIO_FILE_URI_HOST}/__gcs-upload-chunk__/${sessionId}`;
}

export function createGcsFilesAdapter(options: CreateGcsFilesAdapterOptions): GcsFilesAdapter {
  const { storage, config, now = () => new Date(), randomId = () => randomUUID().replace(/-/g, '') } = options;
  const sessions = new Map<string, UploadSessionState>();

  const buildGcsUriForFileId = (fileId: string): string => `gs://${config.bucketName}/${config.objectPrefix}${fileId}`;

  return {
    initiateUpload({ displayName, mimeType, sizeBytes }) {
      if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
        throw new Error(`Invalid file size ${sizeBytes}.`);
      }
      if (sizeBytes > config.maxFileBytes) {
        throw new Error(`File size ${sizeBytes} exceeds GCS_MAX_FILE_BYTES ${config.maxFileBytes}.`);
      }

      const sessionId = randomId();
      sessions.set(sessionId, {
        id: sessionId,
        displayName,
        mimeType,
        totalSize: sizeBytes,
        receivedBytes: 0,
        chunks: [],
      });

      return {
        sessionId,
        uploadUrl: buildChunkUploadUrl(sessionId),
      };
    },

    async uploadChunk({ sessionId, offset, command, chunk }) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Upload session ${sessionId} not found.`);
      }

      if (offset !== session.receivedBytes) {
        throw new Error(`Unexpected upload offset ${offset}; expected ${session.receivedBytes}.`);
      }

      if (session.receivedBytes + chunk.byteLength > config.maxFileBytes) {
        sessions.delete(sessionId);
        throw new Error(`Upload exceeds GCS_MAX_FILE_BYTES ${config.maxFileBytes}.`);
      }

      session.chunks.push(chunk);
      session.receivedBytes += chunk.byteLength;

      const shouldFinalize = command
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .includes('finalize');

      if (!shouldFinalize) {
        return { status: 'active' };
      }

      if (session.receivedBytes !== session.totalSize) {
        sessions.delete(sessionId);
        throw new Error(
          `File size mismatch on finalize: declared ${session.totalSize}, received ${session.receivedBytes}.`,
        );
      }

      const data = Buffer.concat(session.chunks);
      const objectPath = `${config.objectPrefix}${session.id}`;
      const bucket = storage.bucket(config.bucketName);
      const file = bucket.file(objectPath);
      await file.save(data, {
        contentType: session.mimeType,
        metadata: {
          contentType: session.mimeType,
          metadata: {
            'amc-display-name': session.displayName,
          },
        },
      });

      sessions.delete(sessionId);

      const createdAt = now();
      const expirationTime = new Date(createdAt.getTime() + FILE_EXPIRATION_LEEWAY_MS);
      const aiStudioFile: AiStudioFile = {
        name: buildAiStudioFileName(session.id),
        displayName: session.displayName,
        mimeType: session.mimeType,
        sizeBytes: String(session.totalSize),
        createTime: createdAt.toISOString(),
        updateTime: createdAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
        state: 'ACTIVE',
        uri: buildAiStudioFileUri(session.id),
      };

      return { status: 'final', file: aiStudioFile };
    },

    async getFileMetadata(fileId) {
      if (!FILE_ID_PATTERN.test(fileId)) {
        return null;
      }

      const objectPath = `${config.objectPrefix}${fileId}`;
      const bucket = storage.bucket(config.bucketName);
      const file = bucket.file(objectPath);

      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }

      const [metadata] = await file.getMetadata();
      const rawSize = metadata.size;
      const size =
        typeof rawSize === 'number' ? rawSize : Number.parseInt(typeof rawSize === 'string' ? rawSize : '0', 10);
      const createTime = metadata.timeCreated ?? now().toISOString();
      const updateTime = metadata.updated ?? createTime;
      const displayName = metadata.metadata?.['amc-display-name'];
      const mimeType = metadata.contentType ?? 'application/octet-stream';
      const expirationTime = new Date(new Date(createTime).getTime() + FILE_EXPIRATION_LEEWAY_MS).toISOString();

      return {
        name: buildAiStudioFileName(fileId),
        displayName,
        mimeType,
        sizeBytes: String(size),
        createTime,
        updateTime,
        expirationTime,
        state: 'ACTIVE',
        uri: buildAiStudioFileUri(fileId),
      };
    },

    rewriteFileUriInJsonBody(body) {
      const text = body.toString('utf8');
      if (!text.includes(AISTUDIO_FILE_URI_HOST)) {
        return body;
      }

      const rewritten = text.replace(AISTUDIO_FILE_URI_PATTERN, (_, id) => buildGcsUriForFileId(id));

      return Buffer.from(rewritten, 'utf8');
    },

    buildGcsUriForFileId,
  };
}
