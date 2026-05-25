const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface ExtractDocxTextResult {
  text: string;
  messages: string[];
}

export const isDocxFile = (file: { name: string; type: string }) => {
  return file.type === DOCX_MIME_TYPE || file.name.toLowerCase().endsWith('.docx');
};

export const extractDocxText = async (file: Blob): Promise<ExtractDocxTextResult> => {
  return new Promise<ExtractDocxTextResult>((resolve, reject) => {
    const worker = new Worker(new URL('./docxPreview.worker.ts', import.meta.url), { type: 'module' });

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (
      event: MessageEvent<{ type: 'success'; text: string; messages?: string[] } | { type: 'error'; error?: string }>,
    ) => {
      if (event.data.type === 'success') {
        resolve({
          text: event.data.text,
          messages: Array.isArray(event.data.messages) ? event.data.messages : [],
        });
      } else {
        reject(new Error(event.data.error || 'Failed to extract Word document text.'));
      }

      cleanup();
    };

    worker.onerror = (error) => {
      reject(new Error(error.message || 'Failed to start Word document extraction worker.'));
      cleanup();
    };

    worker.postMessage(file);
  });
};
