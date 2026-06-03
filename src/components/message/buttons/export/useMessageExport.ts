import { logService } from '@/services/logService';
import { useState } from 'react';
import { type ChatMessage } from '@/types';
import { serializeMessageForPortableExport } from '@/utils/chat/session';
import { createManagedObjectUrl } from '@/services/objectUrlManager';
import { triggerDownload } from '@/utils/export/core';
import { buildMessageExportFilenameBase, createExportDateMeta, loadExportRuntime } from '@/utils/export/runtime';
import { useI18n } from '@/contexts/I18nContext';

interface UseMessageExportProps {
  message: ChatMessage;
  sessionTitle?: string;
  messageIndex?: number;
  themeId: string;
}

export type ExportType = 'png' | 'html' | 'txt' | 'json';

const EXPORTING_STATE_PAINT_DELAY_MS = 500;
const MESSAGE_PNG_EXPORT_SCALE = 2.5;
const MESSAGE_CONTENT_SELECTORS = ['.message-content-container', '.markdown-body', '.shadow-sm'];

const findMessageContentNode = (messageId: string): HTMLElement | null => {
  const messageWrapper = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageWrapper) return null;

  for (const selector of MESSAGE_CONTENT_SELECTORS) {
    const contentNode = messageWrapper.querySelector<HTMLElement>(selector);
    if (contentNode) return contentNode;
  }

  return null;
};

export const useMessageExport = ({ message, sessionTitle, messageIndex, themeId }: UseMessageExportProps) => {
  const { language, t } = useI18n();
  const [exportingType, setExportingType] = useState<ExportType | null>(null);

  const handleExport = async (type: ExportType, onSuccess?: () => void) => {
    if (exportingType) return;
    setExportingType(type);

    try {
      const markdownContent = message.content || '';
      const messageId = message.id;
      const shortId = messageId.slice(-6);
      const filenameBase = buildMessageExportFilenameBase({
        messageId,
        markdownContent,
        sessionTitle,
        messageIndex,
      });

      const messageDate = new Date(message.timestamp);
      const { dateStr: dateLabel } = createExportDateMeta(messageDate);

      if (type !== 'png') {
        await new Promise((resolve) => setTimeout(resolve, EXPORTING_STATE_PAINT_DELAY_MS));
      }

      const messageContentNode = findMessageContentNode(message.id);

      if (type === 'png' || type === 'html') {
        if (!messageContentNode) {
          throw new Error(t('export_message_content_missing'));
        }

        const { exportHtmlStringAsFile, prepareElementForExport, generateSnapshotPng, buildHtmlDocument } =
          await loadExportRuntime();

        const cleanedContent = await prepareElementForExport(messageContentNode, {
          expandDetails: type === 'png',
        });

        if (type === 'png') {
          const didExport = await generateSnapshotPng(
            cleanedContent,
            `${filenameBase}.png`,
            themeId,
            {
              title: t('export_message_title'),
              metaLeft: dateLabel,
              metaRight: t('export_message_id').replace('{id}', shortId),
            },
            {
              scale: MESSAGE_PNG_EXPORT_SCALE,
              messages: {
                imageTooLarge: t('export_image_too_large'),
                exportFailed: (message) => t('export_failed_with_message').replace('{message}', message),
              },
            },
          );
          if (didExport === false) {
            return;
          }
        } else {
          const wrapper = document.createElement('div');
          wrapper.className = 'markdown-body';
          wrapper.appendChild(cleanedContent);
          const chatHtml = wrapper.outerHTML;

          const fullHtml = await buildHtmlDocument({
            title: t('export_message_html_title').replace('{id}', shortId),
            date: dateLabel,
            model: t('export_message_id').replace('{id}', shortId),
            contentHtml: chatHtml,
            themeId,
            language,
          });

          exportHtmlStringAsFile(fullHtml, `${filenameBase}.html`);
        }
      } else if (type === 'txt') {
        const { exportTextStringAsFile, buildTextDocument } = await loadExportRuntime();
        const txtContent = buildTextDocument({
          title: t('export_message_text_title').replace('{id}', shortId),
          date: dateLabel,
          model: t('export_not_applicable'),
          messages: [
            {
              role: message.role === 'user' ? t('export_role_user') : t('export_role_assistant'),
              timestamp: new Date(message.timestamp),
              content: markdownContent,
              files: message.files?.map((file) => ({ name: file.name })),
            },
          ],
        });
        exportTextStringAsFile(txtContent, `${filenameBase}.txt`);
      } else if (type === 'json') {
        const portableMessage = await serializeMessageForPortableExport(message);
        const blob = new Blob([JSON.stringify(portableMessage, null, 2)], { type: 'application/json' });
        triggerDownload(createManagedObjectUrl(blob), `${filenameBase}.json`);
      }

      onSuccess?.();
    } catch (exportError) {
      logService.error(`Failed to export message as ${type.toUpperCase()}:`, exportError);
      alert(
        t('export_failed_with_message').replace(
          '{message}',
          exportError instanceof Error ? exportError.message : String(exportError),
        ),
      );
    } finally {
      setExportingType(null);
    }
  };

  return {
    exportingType,
    handleExport,
  };
};
