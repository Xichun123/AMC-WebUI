import type { Part } from '@google/genai';
import type { ChatHistoryItem } from '@/types';
import { isImageMimeType } from '@/utils/fileTypeClassification';
import type { AnthropicChatConfig, AnthropicContentBlock, AnthropicMessage } from './anthropicTypes';

const ANTHROPIC_FILE_DATA_ERROR = 'Anthropic mode cannot send Gemini Files API file references.';

const partToAnthropicContentItems = (part: Part): AnthropicContentBlock[] => {
  const partWithMedia = part as Part & {
    inlineData?: { mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
  };

  if (typeof part.text === 'string') {
    return part.text ? [{ type: 'text', text: part.text }] : [];
  }

  if (partWithMedia.fileData) {
    throw new Error(ANTHROPIC_FILE_DATA_ERROR);
  }

  const inlineData = partWithMedia.inlineData;
  const mimeType = inlineData?.mimeType;
  if (inlineData?.data && mimeType && isImageMimeType(mimeType)) {
    return [
      {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: inlineData.data },
      },
    ];
  }

  if (inlineData?.data) {
    throw new Error(`Anthropic mode cannot send inline ${mimeType || 'media'} attachments.`);
  }

  return [];
};

const partsToAnthropicContent = (parts: Part[]): string | AnthropicContentBlock[] => {
  const items = parts.flatMap(partToAnthropicContentItems);
  const hasOnlyText = items.every((item) => item.type === 'text');
  if (hasOnlyText) {
    return items
      .map((item) => (item.type === 'text' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return items;
};

const hasAnthropicContent = (content: string | AnthropicContentBlock[]) =>
  typeof content === 'string' ? content.trim().length > 0 : content.length > 0;

const buildAnthropicMessages = (
  history: ChatHistoryItem[],
  parts: Part[],
  role: 'user' | 'model',
): AnthropicMessage[] => {
  const messages: AnthropicMessage[] = [];
  for (const item of history) {
    const content = partsToAnthropicContent(item.parts);
    if (!hasAnthropicContent(content)) continue;
    messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content });
  }
  const currentContent = partsToAnthropicContent(parts);
  if (hasAnthropicContent(currentContent)) {
    messages.push({ role: role === 'model' ? 'assistant' : 'user', content: currentContent });
  }
  return messages;
};

export const buildAnthropicRequestBody = (
  modelId: string,
  history: ChatHistoryItem[],
  parts: Part[],
  config: AnthropicChatConfig,
  role: 'user' | 'model',
  stream: boolean,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: modelId,
    messages: buildAnthropicMessages(history, parts, role),
    stream,
    max_tokens: 8192,
  };

  const systemInstruction = config.systemInstruction?.trim();
  if (systemInstruction) {
    body.system = systemInstruction;
  }
  if (typeof config.temperature === 'number') {
    body.temperature = config.temperature;
  }
  if (typeof config.topP === 'number') {
    body['top_p'] = config.topP;
  }
  return body;
};
