import { SUPPORTED_UPLOAD_MIME_TYPES } from '@/constants/fileTypeSupport';

const PASTE_TEXT_AS_FILE_THRESHOLD = 5000;

type ChatInputClipboardOptions = {
  isPasteRichTextAsMarkdownEnabled: boolean;
  isPasteAsTextFileEnabled: boolean;
};

type ChatInputPasteResult =
  | { type: 'files'; files: File[] }
  | { type: 'large-text-file'; files: File[] }
  | { type: 'markdown'; content: string }
  | { type: 'text'; content: string }
  | { type: 'empty' };

const isSupportedClipboardFileItem = (item: DataTransferItem) =>
  item.kind === 'file' && SUPPORTED_UPLOAD_MIME_TYPES.includes(item.type);

const hasSupportedClipboardFile = (clipboardData: DataTransfer) => {
  const items = clipboardData.items;
  if (!items) return false;

  for (let i = 0; i < items.length; i++) {
    if (isSupportedClipboardFileItem(items[i])) {
      return true;
    }
  }

  return false;
};

const getSupportedClipboardFiles = (clipboardData: DataTransfer): File[] => {
  const items = clipboardData.items;
  const filesToProcess: File[] = [];
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (isSupportedClipboardFileItem(item)) {
        const file = item.getAsFile();
        if (file) filesToProcess.push(file);
      }
    }
  }

  return filesToProcess;
};

const hasHtmlTags = (htmlContent: string) => /<[a-z][\s\S]*>/i.test(htmlContent);

export const shouldHandleChatInputClipboardData = (
  clipboardData: DataTransfer | null,
  options: ChatInputClipboardOptions,
): boolean => {
  if (!clipboardData) return false;

  if (hasSupportedClipboardFile(clipboardData)) {
    return true;
  }

  const pastedText = clipboardData.getData('text/plain');
  const htmlContent = clipboardData.getData('text/html');

  if (options.isPasteAsTextFileEnabled && pastedText && pastedText.length > PASTE_TEXT_AS_FILE_THRESHOLD) {
    return true;
  }

  return Boolean(htmlContent && options.isPasteRichTextAsMarkdownEnabled && hasHtmlTags(htmlContent));
};

export const processChatInputClipboardData = async (
  clipboardData: DataTransfer | null,
  options: ChatInputClipboardOptions,
): Promise<ChatInputPasteResult> => {
  if (!clipboardData) return { type: 'empty' };

  const filesToProcess = getSupportedClipboardFiles(clipboardData);
  if (filesToProcess.length > 0) {
    return { type: 'files', files: filesToProcess };
  }

  const pastedText = clipboardData.getData('text/plain');
  const htmlContent = clipboardData.getData('text/html');

  if (options.isPasteAsTextFileEnabled && pastedText && pastedText.length > PASTE_TEXT_AS_FILE_THRESHOLD) {
    const timestamp = Math.floor(Date.now() / 1000);
    const fileName = `pasted_content_${timestamp}.txt`;
    const file = new File([pastedText], fileName, { type: 'text/plain' });
    return { type: 'large-text-file', files: [file] };
  }

  if (htmlContent && options.isPasteRichTextAsMarkdownEnabled) {
    if (hasHtmlTags(htmlContent)) {
      const { convertHtmlToMarkdown } = await import('@/utils/htmlToMarkdown');
      const markdown = convertHtmlToMarkdown(htmlContent);
      if (markdown) {
        return { type: 'markdown', content: markdown };
      }
    }
  }

  if (pastedText) {
    return { type: 'text', content: pastedText };
  }

  return { type: 'empty' };
};
