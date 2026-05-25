import { MIME_TO_EXTENSION_MAP } from '@/constants/fileTypeSupport';
import { isAudioMimeType, isImageMimeType, isVideoMimeType } from './fileTypeClassification';

export const getExtensionFromMimeType = (mimeType: string): string => {
  if (MIME_TO_EXTENSION_MAP[mimeType]) return MIME_TO_EXTENSION_MAP[mimeType];

  if (isImageMimeType(mimeType) || isAudioMimeType(mimeType) || isVideoMimeType(mimeType)) {
    const subtype = mimeType.split('/')[1];
    if (subtype) return `.${subtype}`;
  }

  return '.file';
};
