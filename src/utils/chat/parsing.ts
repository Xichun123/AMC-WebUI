import { type UploadedFile } from '@/types';
import { generateUniqueId } from './ids';
import { base64ToBlob } from '@/utils/fileEncoding';
import { getExtensionFromMimeType } from '@/utils/fileMime';
import { createManagedObjectUrl } from '@/services/objectUrlManager';

const getThoughtHeadingTitle = (line: string): string | null => {
  if (line.startsWith('## ') || line.startsWith('### ')) {
    return line.replace(/^[#]+\s*/, '').trim();
  }

  for (const marker of ['**', '__']) {
    if (line.startsWith(marker) && line.endsWith(marker) && !line.slice(2, -2).includes(marker)) {
      return line.substring(2, line.length - 2).trim();
    }
  }

  return null;
};

const buildGeneratedFileName = (baseName: string, extension: string): string => {
  if (baseName.toLowerCase().endsWith(extension)) {
    return baseName;
  }

  if (baseName === 'generated-file' || baseName === 'generated-image') {
    return `${baseName}-${generateUniqueId().slice(-4)}${extension}`;
  }

  return `${baseName}${extension}`;
};

export const parseThoughtProcess = (thoughts: string | undefined) => {
  if (!thoughts) return null;

  const lines = thoughts.trim().split('\n');
  let lastHeadingIndex = -1;
  let lastHeading = '';

  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const headingTitle = getThoughtHeadingTitle(lines[lineIndex].trim());
    if (headingTitle !== null) {
      lastHeadingIndex = lineIndex;
      lastHeading = headingTitle;
      break;
    }
  }

  if (lastHeadingIndex === -1) {
    const content = lines.slice(-5).join('\n').trim();
    return { title: 'Latest thought', content, isFallback: true };
  }

  const contentLines = lines.slice(lastHeadingIndex + 1);
  const content = contentLines
    .filter((l) => l.trim() !== '')
    .join('\n')
    .trim();

  return { title: lastHeading, content, isFallback: false };
};

/**
 * Creates a standardized UploadedFile object from Base64 data.
 * Used for handling generated content from API (images, audio, etc.)
 */
export const createUploadedFileFromBase64 = (
  base64Data: string,
  mimeType: string,
  baseName: string = 'generated-file',
): UploadedFile => {
  const extension = getExtensionFromMimeType(mimeType);
  const fileName = buildGeneratedFileName(baseName, extension);

  const blob = base64ToBlob(base64Data, mimeType);
  const file = new File([blob], fileName, { type: mimeType });
  const dataUrl = createManagedObjectUrl(file);

  return {
    id: generateUniqueId(),
    name: fileName,
    type: mimeType,
    size: blob.size,
    dataUrl,
    rawFile: file,
    uploadState: 'active',
  };
};
