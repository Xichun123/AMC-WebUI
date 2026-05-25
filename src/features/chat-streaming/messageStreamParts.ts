import type { Part } from '@google/genai';
import type { UploadedFile } from '@/types';
import { SUPPORTED_GENERATED_MIME_TYPES } from '@/constants/fileTypeSupport';
import { createUploadedFileFromBase64 } from '@/utils/chat/parsing';
import { generateUniqueId } from '@/utils/chat/ids';
import { isAudioMimeType, isImageMimeType, isVideoMimeType } from '@/utils/fileTypeClassification';

const hasThoughtSignature = (part: Part) =>
  Boolean(
    (part as Part & { thoughtSignature?: string; thought_signature?: string }).thoughtSignature ||
    (part as Part & { thoughtSignature?: string; thought_signature?: string }).thought_signature,
  );

const isPlainTextOnlyPart = (part: Part) => Object.keys(part).every((key) => key === 'text');

export const appendApiPart = (parts: Part[] = [], newPart: Part) => {
  const newParts = [...parts];

  if ('text' in newPart && typeof newPart.text === 'string') {
    const lastPart = newParts[newParts.length - 1];
    if (
      lastPart &&
      'text' in lastPart &&
      typeof lastPart.text === 'string' &&
      !('thought' in lastPart && lastPart.thought) &&
      !hasThoughtSignature(lastPart) &&
      !hasThoughtSignature(newPart) &&
      isPlainTextOnlyPart(lastPart) &&
      isPlainTextOnlyPart(newPart)
    ) {
      newParts[newParts.length - 1] = { ...lastPart, text: lastPart.text + newPart.text } as Part;
      return newParts;
    }
  }

  newParts.push({ ...newPart });
  return newParts;
};

const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const getContentDeltaFromPart = (part: Part): string => {
  const anyPart = part as Part & {
    text?: string;
    executableCode?: { language?: string; code?: string };
    codeExecutionResult?: { outcome?: string; output?: string };
  };

  if (anyPart.text) {
    return anyPart.text;
  }

  if (anyPart.executableCode) {
    const language = anyPart.executableCode.language?.toLowerCase() || 'python';
    return `\n\n\`\`\`${language}\n${anyPart.executableCode.code || ''}\n\`\`\`\n\n`;
  }

  if (anyPart.codeExecutionResult) {
    const outcome = anyPart.codeExecutionResult.outcome || 'UNKNOWN';
    let toolContent = `\n\n<div class="tool-result outcome-${outcome.toLowerCase()}"><strong>Execution Result (${outcome}):</strong>`;
    if (anyPart.codeExecutionResult.output) {
      toolContent += `<pre><code class="language-text">${escapeHtml(anyPart.codeExecutionResult.output)}</code></pre>`;
    }
    toolContent += '</div>\n\n';
    return toolContent;
  }

  return '';
};

export const getGeneratedFileFromPart = (part: Part): UploadedFile | undefined => {
  const partWithInlineData = part as Part & { inlineData?: { mimeType?: string; data?: string } };
  const mimeType = partWithInlineData.inlineData?.mimeType;
  const data = partWithInlineData.inlineData?.data;

  if (!mimeType || !data) {
    return undefined;
  }

  const isSupportedFile =
    isImageMimeType(mimeType) ||
    isAudioMimeType(mimeType) ||
    isVideoMimeType(mimeType) ||
    SUPPORTED_GENERATED_MIME_TYPES.has(mimeType);

  if (!isSupportedFile) {
    return undefined;
  }

  return createUploadedFileFromBase64(
    data,
    mimeType,
    isImageMimeType(mimeType) ? `generated-plot-${generateUniqueId().slice(-4)}` : 'generated-file',
  );
};

export const mergeUniqueFiles = (existing: UploadedFile[] = [], incoming: UploadedFile[] = []) => {
  const files = [...existing];
  const seen = new Set(files.map((file) => file.id));

  for (const file of incoming) {
    if (!seen.has(file.id)) {
      files.push(file);
      seen.add(file.id);
    }
  }

  return files;
};
