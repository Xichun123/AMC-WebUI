import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extractDocxText } from './docxPreview';

class MockWorker {
  static instances: MockWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly terminate = vi.fn();

  constructor(
    readonly scriptUrl: string | URL,
    readonly options?: WorkerOptions,
  ) {
    MockWorker.instances.push(this);
  }

  postMessage() {
    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          type: 'success',
          text: 'Extracted text',
          messages: [],
        },
      } as MessageEvent);
    });
  }
}

describe('docx preview extraction', () => {
  const originalWorker = globalThis.Worker;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    MockWorker.instances = [];
    globalThis.Worker = MockWorker as unknown as typeof Worker;
    URL.createObjectURL = vi.fn(() => 'blob:docx-preview-worker');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('uses a bundled worker module so Word extraction does not depend on a CDN', async () => {
    const file = new File(['docx bytes'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await expect(extractDocxText(file)).resolves.toEqual({ text: 'Extracted text', messages: [] });

    expect(MockWorker.instances).toHaveLength(1);
    expect(String(MockWorker.instances[0]?.scriptUrl)).toContain('docxPreview.worker');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
