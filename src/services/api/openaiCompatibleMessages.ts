import type { Part } from '@google/genai';
import type { ChatHistoryItem } from '@/types';
import { isAudioMimeType, isImageMimeType } from '@/utils/fileTypeUtils';
import type { OpenAICompatibleChatConfig, OpenAIMessage, OpenAIMessageContent } from './openaiCompatibleTypes';

const OPENAI_COMPATIBLE_FILE_DATA_ERROR = 'OpenAI-compatible mode cannot send Gemini Files API file references.';

const getInlineAudioFormat = (mimeType: string): string => {
  const subtype = mimeType.split('/')[1]?.split(';')[0]?.trim();
  return subtype || 'wav';
};

const partToOpenAIContentItems = (part: Part): Exclude<OpenAIMessageContent, string> => {
  const partWithMedia = part as Part & {
    inlineData?: {
      mimeType?: string;
      data?: string;
    };
    fileData?: {
      mimeType?: string;
      fileUri?: string;
    };
  };

  if (typeof part.text === 'string') {
    return part.text ? [{ type: 'text', text: part.text }] : [];
  }

  if (partWithMedia.fileData) {
    throw new Error(OPENAI_COMPATIBLE_FILE_DATA_ERROR);
  }

  const inlineData = partWithMedia.inlineData;
  const mimeType = inlineData?.mimeType;
  if (inlineData?.data && mimeType && isImageMimeType(mimeType)) {
    return [
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${inlineData.data}`,
        },
      },
    ];
  }

  if (inlineData?.data && mimeType && isAudioMimeType(mimeType)) {
    return [
      {
        type: 'input_audio',
        input_audio: {
          data: inlineData.data,
          format: getInlineAudioFormat(mimeType),
        },
      },
    ];
  }

  if (inlineData?.data) {
    throw new Error(`OpenAI-compatible mode cannot send inline ${mimeType || 'media'} attachments.`);
  }

  return [];
};

const partsToOpenAIContent = (parts: Part[]): OpenAIMessageContent => {
  const contentItems = parts.flatMap(partToOpenAIContentItems);
  const hasOnlyText = contentItems.every((item) => item.type === 'text');

  if (hasOnlyText) {
    return contentItems
      .map((item) => (item.type === 'text' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
  }

  return contentItems;
};

const hasOpenAIContent = (content: OpenAIMessageContent) =>
  typeof content === 'string' ? content.trim().length > 0 : content.length > 0;

const buildOpenAICompatibleMessages = (
  history: ChatHistoryItem[],
  parts: Part[],
  role: 'user' | 'model',
  config: OpenAICompatibleChatConfig,
): OpenAIMessage[] => {
  const messages: OpenAIMessage[] = [];
  const systemInstruction = config.systemInstruction?.trim();

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  for (const item of history) {
    const content = partsToOpenAIContent(item.parts);
    if (!hasOpenAIContent(content)) {
      continue;
    }

    messages.push({
      role: item.role === 'model' ? 'assistant' : 'user',
      content,
    });
  }

  const currentContent = partsToOpenAIContent(parts);
  if (hasOpenAIContent(currentContent)) {
    messages.push({
      role: role === 'model' ? 'assistant' : 'user',
      content: currentContent,
    });
  }

  return messages;
};

export const buildOpenAICompatibleRequestBody = (
  modelId: string,
  history: ChatHistoryItem[],
  parts: Part[],
  config: OpenAICompatibleChatConfig,
  role: 'user' | 'model',
  stream: boolean,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: buildOpenAICompatibleMessages(history, parts, role, config),
    stream,
  };

  if (typeof config.temperature === 'number') {
    body.temperature = config.temperature;
  }

  if (typeof config.topP === 'number') {
    body.top_p = config.topP;
  }

  if (stream) {
    body.stream_options = { include_usage: true };
  }

  return body;
};
