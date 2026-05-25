import { type UploadedFile } from '@/types';

const isClipboardTextType = (mimeType: string): boolean => {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType.includes('javascript') ||
    mimeType.includes('xml')
  );
};

export const copyFileToClipboard = async (file: Pick<UploadedFile, 'dataUrl' | 'type'>): Promise<void> => {
  if (!file.dataUrl) {
    throw new Error('File preview URL is missing.');
  }

  const response = await fetch(file.dataUrl);
  const blob = await response.blob();

  if (isClipboardTextType(file.type)) {
    const text = await blob.text();
    await navigator.clipboard.writeText(text);
    return;
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard API not available.');
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob,
    }),
  ]);
};
