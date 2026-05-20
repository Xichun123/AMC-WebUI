import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadGeminiFileResumable, type InternalGeminiApiClient } from './geminiResumableUpload';

type UploadRequestRecord = {
  url: string;
  headers: Record<string, string>;
  bodySize: number;
};

const uploadRequests: UploadRequestRecord[] = [];

class FakeUploadEventTarget {
  private listeners = new Set<(event: ProgressEvent) => void>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== 'progress') return;
    this.listeners.add(listener as (event: ProgressEvent) => void);
  }

  dispatchProgress(loaded: number, total: number) {
    const event = new ProgressEvent('progress', {
      lengthComputable: true,
      loaded,
      total,
    });
    this.listeners.forEach((listener) => listener(event));
  }
}

class FakeXMLHttpRequest {
  upload = new FakeUploadEventTarget();
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private requestHeaders: Record<string, string> = {};
  private responseHeaders: Record<string, string> = {};
  private requestUrl = '';

  open(_method: string, url: string) {
    this.requestUrl = url;
  }

  setRequestHeader(header: string, value: string) {
    this.requestHeaders[header] = value;
  }

  getAllResponseHeaders() {
    return Object.entries(this.responseHeaders)
      .map(([header, value]) => `${header}: ${value}`)
      .join('\r\n');
  }

  send(body?: XMLHttpRequestBodyInit | null) {
    const blob = body instanceof Blob ? body : undefined;
    uploadRequests.push({
      url: this.requestUrl,
      headers: { ...this.requestHeaders },
      bodySize: blob?.size ?? 0,
    });

    queueMicrotask(() => {
      const total = blob?.size ?? 0;
      this.upload.dispatchProgress(total, total);
      this.status = 200;
      this.responseText = JSON.stringify({ file: { name: 'files/test-file' } });
      this.responseHeaders = {
        'content-type': 'application/json',
        'x-goog-upload-status': 'final',
      };
      this.onload?.();
    });
  }

  abort() {
    this.onabort?.();
  }
}

describe('uploadGeminiFileResumable', () => {
  beforeEach(() => {
    uploadRequests.length = 0;
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
  });

  it('starts the upload session against the configured Gemini base URL and uploads through the proxy path', async () => {
    const apiClient: InternalGeminiApiClient = {
      request: async () => ({
        headers: {
          'x-goog-upload-url': 'https://upload.example.com/resumable/session-1',
        },
        json: async () => ({}),
      }),
    };
    const onProgress = vi.fn();

    const uploadedFile = await uploadGeminiFileResumable({
      apiClient,
      apiBaseUrl: 'https://proxy.example.com/gemini',
      proxyBaseUrl: 'https://proxy.example.com/gemini',
      apiKey: 'api-key',
      file: new File(['hello'], 'sample.txt', { type: 'text/plain' }),
      mimeType: 'text/plain',
      displayName: 'sample.txt',
      signal: new AbortController().signal,
      onProgress,
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]).toMatchObject({
      url: 'https://proxy.example.com/gemini/resumable/session-1',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
        'x-goog-api-key': 'api-key',
      },
      bodySize: 5,
    });
    expect(onProgress).toHaveBeenCalledWith(5, 5);
    expect(uploadedFile.name).toBe('files/test-file');
  });
});
