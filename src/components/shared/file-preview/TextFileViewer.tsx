import { logService } from '@/services/logService';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { type UploadedFile } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { LazyMarkdownRenderer } from '@/components/message/LazyMarkdownRenderer';
import { LARGE_FILE_PREVIEW_LENGTH_THRESHOLD, shouldDeferMarkdownPreview } from './markdownPreviewPolicy';

interface TextFileViewerProps {
  file: UploadedFile;
  content?: string | null;
  renderMode?: 'plain' | 'markdown';
  themeId?: string;
  isEditable?: boolean;
  onChange?: (value: string) => void;
  onLoad?: (content: string) => void;
}

const ROW_HEIGHT_PX = 21;
const VERTICAL_PADDING_PX = 96;
const VIRTUALIZATION_OVERSCAN_ROWS = 15;

const VirtualTextViewer: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const lines = useMemo(() => content.split(/\r\n|\r|\n/), [content]);
  const totalHeight = lines.length * ROW_HEIGHT_PX + VERTICAL_PADDING_PX * 2;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) setViewportHeight(containerRef.current.clientHeight);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const effectiveScrollTop = Math.max(0, scrollTop - VERTICAL_PADDING_PX);
  const startIndex = Math.max(0, Math.floor(effectiveScrollTop / ROW_HEIGHT_PX) - VIRTUALIZATION_OVERSCAN_ROWS);
  const endIndex = Math.min(
    lines.length - 1,
    Math.ceil((effectiveScrollTop + viewportHeight) / ROW_HEIGHT_PX) + VIRTUALIZATION_OVERSCAN_ROWS,
  );

  const visibleLines = [];
  for (let lineIndex = startIndex; lineIndex <= endIndex; lineIndex++) {
    visibleLines.push(
      <div
        key={lineIndex}
        className="absolute left-1/2 -translate-x-1/2 w-full max-w-5xl px-8 whitespace-pre font-mono text-sm leading-[21px] text-[var(--theme-text-primary)]"
        style={{ top: VERTICAL_PADDING_PX + lineIndex * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
      >
        {lines[lineIndex]}
      </div>,
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto custom-scrollbar relative" onScroll={onScroll}>
      <div style={{ height: totalHeight, minWidth: '100%' }} className="relative">
        {visibleLines}
      </div>
    </div>
  );
};

export const TextFileViewer: React.FC<TextFileViewerProps> = ({
  file,
  content,
  renderMode = 'plain',
  themeId = 'pearl',
  isEditable = false,
  onChange,
  onLoad,
}) => {
  const { t } = useI18n();
  const [localContent, setLocalContent] = useState<string | null>(null);
  const hasProvidedContent = content !== undefined && content !== null;
  const [isLoading, setIsLoading] = useState(() => !hasProvidedContent && !!file.dataUrl);
  const [forcedMarkdownPreviewKey, setForcedMarkdownPreviewKey] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (hasProvidedContent) {
      return;
    }

    if (file.dataUrl) {
      fetch(file.dataUrl)
        .then((response) => response.text())
        .then((text) => {
          setLocalContent(text);
          if (onLoad) onLoad(text);
          setIsLoading(false);
        })
        .catch((error) => {
          logService.error('Failed to load text content', error);
          setLocalContent(t('filePreview_failed_text_content'));
          setIsLoading(false);
        });
    }
  }, [file, hasProvidedContent, onLoad, t]);

  useEffect(() => {
    if (isEditable && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditable]);

  const displayContent = content ?? localContent;
  const markdownPreviewKey = `${file.id}:${file.name}:${renderMode}:${displayContent ?? ''}`;
  const shouldForceMarkdownRender = forcedMarkdownPreviewKey === markdownPreviewKey;
  const isLargeFile = (displayContent?.length || 0) > LARGE_FILE_PREVIEW_LENGTH_THRESHOLD;
  const shouldShowLoading = hasProvidedContent ? false : isLoading;
  const shouldRenderMarkdown = !isEditable && renderMode === 'markdown' && !shouldShowLoading;
  const shouldDeferMarkdown =
    shouldRenderMarkdown && !shouldForceMarkdownRender && shouldDeferMarkdownPreview(displayContent || '');
  const shouldVirtualizePlainText = isLargeFile && (!shouldRenderMarkdown || shouldDeferMarkdown);

  const plainTextSurface = shouldVirtualizePlainText ? (
    <VirtualTextViewer content={displayContent || ''} />
  ) : (
    <div className="w-full h-full p-4 sm:p-8 pt-24 pb-24 overflow-auto custom-scrollbar select-text cursor-text">
      <div className="max-w-4xl mx-auto min-h-[50vh] rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] p-6 shadow-xl">
        <pre className="text-sm font-mono text-[var(--theme-text-primary)] whitespace-pre-wrap break-all">
          {displayContent}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full relative group bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)]">
      {shouldShowLoading ? (
        <div className="flex items-center justify-center h-full text-[var(--theme-text-tertiary)]">
          <Loader2 className="animate-spin mr-2" /> {t('filePreview_loading_text_content')}
        </div>
      ) : isEditable ? (
        <textarea
          ref={textareaRef}
          value={displayContent || ''}
          onChange={(event) => onChange && onChange(event.target.value)}
          className="w-full h-full p-4 sm:p-8 pt-24 pb-24 bg-transparent text-sm font-mono text-[var(--theme-text-primary)] whitespace-pre-wrap break-all outline-none resize-none custom-scrollbar"
          spellCheck={false}
        />
      ) : shouldDeferMarkdown ? (
        <div className="w-full h-full flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)]">
            <p className="text-sm text-[var(--theme-text-secondary)]">{t('filePreview_large_markdown_notice')}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-[var(--theme-border-focus)] bg-[var(--theme-bg-accent)]/10 px-3 py-1.5 text-sm font-medium text-[var(--theme-text-primary)] transition-colors hover:bg-[var(--theme-bg-accent)]/20"
              onClick={() => setForcedMarkdownPreviewKey(markdownPreviewKey)}
            >
              {t('filePreview_render_markdown_anyway')}
            </button>
          </div>
          <div className="flex-1 min-h-0">{plainTextSurface}</div>
        </div>
      ) : shouldRenderMarkdown ? (
        <div className="w-full h-full p-4 sm:p-8 pt-24 pb-24 overflow-auto custom-scrollbar select-text cursor-text">
          <div className="markdown-body max-w-4xl mx-auto min-h-[50vh] rounded-xl border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] p-6 shadow-xl sm:p-8">
            <LazyMarkdownRenderer
              content={displayContent || ''}
              isLoading={false}
              onImageClick={() => {}}
              onOpenHtmlPreview={() => {}}
              onOpenSidePanel={() => {}}
              expandCodeBlocksByDefault={true}
              isMermaidRenderingEnabled={false}
              isGraphvizRenderingEnabled={false}
              allowHtml={true}
              themeId={themeId}
              interactiveMode="disabled"
              fallbackMode="raw"
            />
          </div>
        </div>
      ) : (
        plainTextSurface
      )}
    </div>
  );
};
