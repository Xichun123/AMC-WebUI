import { logService } from '@/services/logService';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createManagedObjectUrl } from '@/services/objectUrlManager';
import { triggerDownload } from '@/utils/export/core';
import {
  createInlineImagePlaceholder,
  extractInlineImagePlaceholders,
  resolveInlineImagePlaceholders,
} from '@/utils/inlineImagePlaceholders';
import { isImageMimeType } from '@/utils/fileTypeClassification';
import { CREATE_TEXT_FILE_EDITOR_LAST_EXTENSION_KEY } from '@/constants/storageKeys';
import { useI18n } from '@/contexts/I18nContext';
import { CREATE_FILE_EXTENSION_OPTIONS } from './createFileExtensionOptions';

interface UseCreateFileEditorProps {
  initialContent: string;
  initialFilename: string;
  onConfirm: (content: string | Blob, filename: string) => void;
  themeId: string;
  isPasteRichTextAsMarkdownEnabled: boolean;
}

const EDITOR_CONTENT_DEBOUNCE_MS = 300;
const EDITOR_FOCUS_DELAY_MS = 100;

export const useCreateFileEditor = ({
  initialContent,
  initialFilename,
  onConfirm,
  themeId,
  isPasteRichTextAsMarkdownEnabled,
}: UseCreateFileEditorProps) => {
  const { t } = useI18n();
  const initialInlineImagesRef = useRef(extractInlineImagePlaceholders(initialContent));
  const imagePlaceholdersRef = useRef(initialInlineImagesRef.current.placeholders);
  const nextImageIndexRef = useRef(initialInlineImagesRef.current.nextIndex);

  const [textContent, setTextContent] = useState(initialInlineImagesRef.current.editorContent);
  const [debouncedEditorContent, setDebouncedEditorContent] = useState(initialInlineImagesRef.current.editorContent);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [filenameBase, setFilenameBase] = useState(() => {
    if (!initialFilename) return '';
    const lastDotIndex = initialFilename.lastIndexOf('.');
    if (lastDotIndex === -1) return initialFilename;
    return initialFilename.substring(0, lastDotIndex);
  });

  const [extension, setExtension] = useState(() => {
    if (!initialFilename) {
      if (typeof window !== 'undefined') {
        const storedExtension = window.localStorage.getItem(CREATE_TEXT_FILE_EDITOR_LAST_EXTENSION_KEY);
        if (storedExtension && CREATE_FILE_EXTENSION_OPTIONS.includes(storedExtension)) {
          return storedExtension;
        }
      }
      return '.md';
    }
    const lastDotIndex = initialFilename.lastIndexOf('.');
    if (lastDotIndex === -1) return '.md';
    const ext = initialFilename.substring(lastDotIndex);
    return ext;
  });

  const handleSetExtension = useCallback((nextExtension: string) => {
    setExtension(nextExtension);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CREATE_TEXT_FILE_EDITOR_LAST_EXTENSION_KEY, nextExtension);
    }
  }, []);

  const isEditing = initialFilename !== '';
  const isPdf = extension === '.pdf';
  const supportsRichPreview = ['.md', '.markdown', '.pdf'].includes(extension);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedEditorContent(textContent), EDITOR_CONTENT_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [textContent]);

  const debouncedContent = useMemo(
    () => resolveInlineImagePlaceholders(debouncedEditorContent, imagePlaceholdersRef.current),
    [debouncedEditorContent],
  );

  const generatePdfBlob = async (filename: string): Promise<Blob> =>
    (await import('@/utils/export/markdownPdf')).createMarkdownPdfBlob(
      resolveInlineImagePlaceholders(textContent, imagePlaceholdersRef.current),
      {
        filename,
        themeId,
      },
    );

  const handleSave = async (isProcessing: boolean) => {
    if (isProcessing) return;

    let finalName = filenameBase.trim() || `file-${Date.now()}`;
    if (!finalName.endsWith(extension)) {
      finalName += extension;
    }

    if (isPdf) {
      setIsExportingPdf(true);
      try {
        const pdfBlob = await generatePdfBlob(finalName);
        onConfirm(pdfBlob, finalName);
      } catch (error) {
        logService.error('PDF generation error:', error);
        alert(t('createText_pdf_error'));
      } finally {
        setIsExportingPdf(false);
      }
    } else {
      onConfirm(resolveInlineImagePlaceholders(textContent, imagePlaceholdersRef.current), finalName);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    const finalName = `${filenameBase.trim() || 'document'}.pdf`;

    try {
      const pdfBlob = await generatePdfBlob(finalName);
      triggerDownload(createManagedObjectUrl(pdfBlob), finalName);
    } catch (error) {
      logService.error('PDF Export failed:', error);
      alert(t('createText_pdf_error'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const insertImageFile = useCallback((file: File, startPos: number, endPos: number = startPos) => {
    const placeholder = createInlineImagePlaceholder(nextImageIndexRef.current++);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        imagePlaceholdersRef.current.set(placeholder, dataUrl);
        const imageName = file.name || `image-${Date.now()}.png`;
        const markdownImage = `\n![${imageName}](${placeholder})\n`;

        setTextContent((prev) => {
          const safeStart = Math.min(startPos, prev.length);
          const safeEnd = Math.min(endPos, prev.length);
          return prev.substring(0, safeStart) + markdownImage + prev.substring(safeEnd);
        });

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const newCursorPos = startPos + markdownImage.length;
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 50);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      const items = event.clipboardData?.items;

      if (items) {
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          const item = items[itemIndex];
          if (isImageMimeType(item.type)) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              const start = textarea ? textarea.selectionStart : textContent.length;
              const end = textarea ? textarea.selectionEnd : textContent.length;
              insertImageFile(file, start, end);
              return;
            }
          }
        }
      }

      if (isPasteRichTextAsMarkdownEnabled !== false) {
        const htmlContent = event.clipboardData.getData('text/html');
        if (htmlContent && /<[a-z][\s\S]*>/i.test(htmlContent)) {
          event.preventDefault();
          const start = textarea ? textarea.selectionStart : textContent.length;
          const end = textarea ? textarea.selectionEnd : textContent.length;

          void (async () => {
            const { convertHtmlToMarkdown } = await import('@/utils/htmlToMarkdown');
            const markdown = convertHtmlToMarkdown(htmlContent);
            if (markdown && textarea) {
              const newValue = textContent.substring(0, start) + markdown + textContent.substring(end);
              setTextContent(newValue);
              setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + markdown.length, start + markdown.length);
              }, 0);
            }
          })();
          return;
        }
      }
    },
    [isPasteRichTextAsMarkdownEnabled, insertImageFile, textContent],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent, isDragging: boolean) => {
      if (!isDragging) return;

      const items = event.dataTransfer.items;
      let file: File | null = null;

      if (items) {
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
          const item = items[itemIndex];
          if (item.kind === 'file' && isImageMimeType(item.type)) {
            file = item.getAsFile();
            break;
          }
        }
      } else if (event.dataTransfer.files) {
        for (let fileIndex = 0; fileIndex < event.dataTransfer.files.length; fileIndex++) {
          const candidateFile = event.dataTransfer.files[fileIndex];
          if (isImageMimeType(candidateFile.type)) {
            file = candidateFile;
            break;
          }
        }
      }

      if (file) {
        const cursorPosition = textareaRef.current ? textareaRef.current.selectionStart : textContent.length;
        insertImageFile(file, cursorPosition);
      }
    },
    [insertImageFile, textContent],
  );

  useEffect(() => {
    const shouldFocus = !isPreviewMode || window.innerWidth >= 1024;
    if (shouldFocus) {
      const timer = setTimeout(() => {
        if (textareaRef.current && textareaRef.current.offsetParent !== null) {
          textareaRef.current.focus();
          if (isEditing) {
            const textLength = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(textLength, textLength);
          }
        }
      }, EDITOR_FOCUS_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isEditing, isPreviewMode]);

  useEffect(() => {
    const shouldDisableUnsupportedPreview = !supportsRichPreview && isPreviewMode;
    if (shouldDisableUnsupportedPreview) {
      setIsPreviewMode(false);
    }
  }, [supportsRichPreview, isPreviewMode]);

  return {
    textContent,
    setTextContent,
    debouncedContent,
    filenameBase,
    setFilenameBase,
    extension,
    setExtension: handleSetExtension,
    isPreviewMode,
    setIsPreviewMode,
    isExportingPdf,
    textareaRef,
    isEditing,
    isPdf,
    supportsRichPreview,
    handleSave,
    handleDownloadPdf,
    handlePaste,
    handleDrop,
  };
};
