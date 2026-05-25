import { createManagedObjectUrl, releaseManagedObjectUrl } from '@/services/objectUrlManager';

export const fileToBlobUrl = (file: File | Blob): string => {
  return createManagedObjectUrl(file);
};

export const cleanupFilePreviewUrl = (file: { dataUrl?: string } | undefined) => {
  if (file?.dataUrl?.startsWith('blob:')) {
    releaseManagedObjectUrl(file.dataUrl);
  }
};

export const cleanupReplacedFilePreviewUrl = (
  previousFile: { dataUrl?: string } | undefined,
  nextFile: { dataUrl?: string } | undefined,
) => {
  if (previousFile?.dataUrl && previousFile.dataUrl !== nextFile?.dataUrl) {
    cleanupFilePreviewUrl(previousFile);
  }
};

export const cleanupFilePreviewUrls = (files: { dataUrl?: string }[] | undefined) => {
  files?.forEach(cleanupFilePreviewUrl);
};
