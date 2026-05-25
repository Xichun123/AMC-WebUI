import type { UploadedFile } from '@/types';
import { logService } from '@/services/logService';
import { CODE_EXECUTION_TEXT_FILE_LIMIT_BYTES } from '@/utils/codeExecution';
import { isImageMimeType, isPdfMimeType, isTextFile } from '@/utils/fileTypeClassification';
import type { MessageSenderTranslator } from './types';

interface MessageSendPermissions {
  canAcceptAttachments: boolean;
  requiresTextPrompt: boolean;
}

interface ValidateMessageBeforeSendOptions {
  text: string;
  files: UploadedFile[];
  permissions: MessageSendPermissions;
  isContinueMode: boolean;
  isServerCodeExecutionEnabled: boolean;
  isImageEditModel: boolean;
  isGemini3Image: boolean;
  activeModelId: string;
  t: MessageSenderTranslator;
}

type MessageSendValidationResult = { ok: true } | { ok: false; fileError?: string };

const isHostedGemma4TextImageModel = (modelId: string): boolean => {
  const normalizedModelId = modelId.toLowerCase().replace(/^models\//, '');
  return normalizedModelId === 'gemma-4-31b-it' || normalizedModelId === 'gemma-4-26b-a4b-it';
};

export const validateMessageBeforeSend = ({
  text,
  files,
  permissions,
  isContinueMode,
  isServerCodeExecutionEnabled,
  isImageEditModel,
  isGemini3Image,
  activeModelId,
  t,
}: ValidateMessageBeforeSendOptions): MessageSendValidationResult => {
  const trimmedText = text.trim();

  if (
    !trimmedText &&
    !permissions.requiresTextPrompt &&
    !isContinueMode &&
    files.filter((file) => file.uploadState === 'active').length === 0
  ) {
    return { ok: false };
  }

  if (permissions.requiresTextPrompt && !trimmedText) {
    return { ok: false };
  }

  if (files.some((file) => file.isProcessing || (file.uploadState !== 'active' && !file.error))) {
    logService.warn('Send message blocked: files are still processing.');
    return { ok: false, fileError: t('messageSender_waitForFiles') };
  }

  if (files.some((file) => file.uploadState === 'failed' || file.uploadState === 'cancelled' || !!file.error)) {
    logService.warn('Send message blocked: failed or cancelled attachments are still selected.');
    return { ok: false, fileError: t('messageSender_fileUploadFailedBeforeSend') };
  }

  if (isServerCodeExecutionEnabled) {
    const oversizedTextFile = files.find(
      (file) => file.uploadState === 'active' && isTextFile(file) && file.size > CODE_EXECUTION_TEXT_FILE_LIMIT_BYTES,
    );

    if (oversizedTextFile) {
      logService.warn('Send message blocked: code execution text file is too large.', {
        fileName: oversizedTextFile.name,
        fileSize: oversizedTextFile.size,
      });
      return { ok: false, fileError: t('messageSender_codeExecutionTextFileTooLarge') };
    }
  }

  if (isImageEditModel || isGemini3Image) {
    const allowsPdfReferences = activeModelId === 'gemini-3.1-flash-image-preview';
    const hasUnsupportedAttachments = files.some((file) => {
      if (isImageMimeType(file.type)) return false;
      if (allowsPdfReferences && isPdfMimeType(file.type)) return false;
      return true;
    });

    if (hasUnsupportedAttachments) {
      logService.warn('Send message blocked: image model received unsupported attachment types.', {
        activeModelId,
        attachmentTypes: files.map((file) => file.type),
      });
      return {
        ok: false,
        fileError: allowsPdfReferences
          ? t('messageSender_imageModelSupportsImageAndPdfOnly')
          : t('messageSender_imageModelSupportsImageOnly'),
      };
    }
  }

  const imageReferenceCount = files.filter((file) => isImageMimeType(file.type)).length;
  if (isGemini3Image && imageReferenceCount > 14) {
    logService.warn('Send message blocked: Gemini 3 image model reference image limit exceeded.', {
      imageReferenceCount,
      activeModelId,
    });
    return { ok: false, fileError: t('messageSender_imageReferenceLimit') };
  }

  if (isHostedGemma4TextImageModel(activeModelId)) {
    const hasUnsupportedGemmaAttachment = files.some((file) => !isTextFile(file) && !isImageMimeType(file.type));
    if (hasUnsupportedGemmaAttachment) {
      logService.warn('Send message blocked: hosted Gemma 4 model received unsupported attachment types.', {
        activeModelId,
        attachmentTypes: files.map((file) => file.type),
      });
      return { ok: false, fileError: t('messageSender_gemma4TextImageOnly') };
    }
  }

  if (!permissions.canAcceptAttachments && files.length > 0) {
    logService.warn('Send message blocked: Imagen models do not support file attachments.');
    return { ok: false, fileError: t('messageSender_imagenTextOnly') };
  }

  return { ok: true };
};
