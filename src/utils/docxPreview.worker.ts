import * as mammoth from 'mammoth';

type DocxWorkerResponse =
  | {
      type: 'success';
      text: string;
      messages: string[];
    }
  | {
      type: 'error';
      error: string;
    };

const postResponse = (response: DocxWorkerResponse) => {
  self.postMessage(response);
};

const normalizeMammothMessage = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }

  if (message && typeof message === 'object' && 'message' in message && typeof message.message === 'string') {
    return message.message;
  }

  return String(message);
};

self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    const arrayBuffer = await event.data.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    postResponse({
      type: 'success',
      text: result.value,
      messages: result.messages.map(normalizeMammothMessage),
    });
  } catch (error) {
    postResponse({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
