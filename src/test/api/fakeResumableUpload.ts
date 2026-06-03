type FakeUploadRequestRecord = {
  url: string;
  headers: Record<string, string>;
  bodySize: number;
};

type FakeUploadResponseScenario = {
  status?: number;
  responseText?: string;
  responseHeaders?: Record<string, string>;
  progressFractions?: number[];
};

type FakeUploadXhrOptions = {
  defaultProgressFractions?: number[];
  defaultResponseText?: string | ((context: { isFinalChunk: boolean }) => string);
  defaultResponseHeaders?: Record<string, string> | ((context: { isFinalChunk: boolean }) => Record<string, string>);
};

const resolveOption = <T>(value: T | ((context: { isFinalChunk: boolean }) => T), isFinalChunk: boolean): T =>
  typeof value === 'function' ? (value as (context: { isFinalChunk: boolean }) => T)({ isFinalChunk }) : value;

export const createFakeResumableUploadXhr = (options: FakeUploadXhrOptions = {}) => {
  const requests: FakeUploadRequestRecord[] = [];
  const scenarios: FakeUploadResponseScenario[] = [];

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
      requests.push({
        url: this.requestUrl,
        headers: { ...this.requestHeaders },
        bodySize: blob?.size ?? 0,
      });

      const command =
        this.requestHeaders['X-Goog-Upload-Command'] ?? this.requestHeaders['x-goog-upload-command'] ?? 'upload';
      const isFinalChunk = /finalize/i.test(command);
      const scenario = scenarios.shift() ?? {};

      queueMicrotask(() => {
        const total = blob?.size ?? 0;
        const progressFractions = scenario.progressFractions ?? options.defaultProgressFractions ?? [1];
        progressFractions.forEach((fraction) => {
          this.upload.dispatchProgress(Math.round(total * fraction), total);
        });

        this.status = scenario.status ?? 200;
        this.responseText =
          scenario.responseText ?? resolveOption(options.defaultResponseText ?? JSON.stringify({}), isFinalChunk);
        this.responseHeaders =
          scenario.responseHeaders ??
          resolveOption(
            options.defaultResponseHeaders ?? {
              'content-type': 'application/json',
              'x-goog-upload-status': isFinalChunk ? 'final' : 'active',
            },
            isFinalChunk,
          );

        this.onload?.();
      });
    }

    abort() {
      this.onabort?.();
    }
  }

  return {
    requests,
    scenarios,
    XMLHttpRequest: FakeXMLHttpRequest,
    reset: () => {
      requests.length = 0;
      scenarios.length = 0;
    },
  };
};
