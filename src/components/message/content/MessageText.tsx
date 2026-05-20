import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type ChatMessage, type UploadedFile, type AppSettings, type SideViewContent } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { LazyMarkdownRenderer } from '@/components/message/LazyMarkdownRenderer';
import { GroundedResponse } from '@/components/message/GroundedResponse';
import { GoogleSpinner } from '@/components/icons/GoogleSpinner';
import { extractPreviewableCodeBlock, normalizePreviewableMarkdownContent } from '@/utils/codeUtils';
import { useSmoothStreaming } from '@/hooks/ui/useSmoothStreaming';
import { useMessageStream } from '@/hooks/ui/useMessageStream';
import { extractRawThinkingBlocks } from '@/utils/chat/reasoning';
import type { LiveArtifactFollowupPayload } from '@/utils/liveArtifactFollowup';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MessageTextProps {
  message: ChatMessage;
  showThoughts: boolean;
  appSettings: AppSettings;
  themeId: string;
  baseFontSize: number;
  onImageClick: (file: UploadedFile) => void;
  onOpenHtmlPreview: (html: string, options?: { initialTrueFullscreen?: boolean }) => void;
  onLiveArtifactFollowUp?: (payload: LiveArtifactFollowupPayload) => void;
  expandCodeBlocksByDefault: boolean;
  isMermaidRenderingEnabled: boolean;
  isGraphvizRenderingEnabled: boolean;
  onOpenSidePanel: (content: SideViewContent) => void;
}

const USER_MESSAGE_COLLAPSE_CHARACTER_THRESHOLD = 600;
const USER_MESSAGE_COLLAPSE_LINE_THRESHOLD = 8;
const USER_MESSAGE_COLLAPSED_LINE_HEIGHT = 1.65;

const shouldCollapseUserMessageContent = (content: string): boolean => {
  if (content.length > USER_MESSAGE_COLLAPSE_CHARACTER_THRESHOLD) return true;
  return (content.match(/\n/g)?.length ?? 0) + 1 > USER_MESSAGE_COLLAPSE_LINE_THRESHOLD;
};

const getUserMessageCollapseKey = (messageId: string, content: string): string =>
  `${messageId}:${content.length}:${content.slice(0, 64)}:${content.slice(-64)}`;

export const MessageText: React.FC<MessageTextProps> = ({
  message,
  showThoughts,
  appSettings,
  themeId,
  baseFontSize,
  onImageClick,
  onOpenHtmlPreview,
  onLiveArtifactFollowUp,
  expandCodeBlocksByDefault,
  isMermaidRenderingEnabled,
  isGraphvizRenderingEnabled,
  onOpenSidePanel,
}) => {
  const { t } = useI18n();
  const { content, audioSrc, groundingMetadata, urlContextMetadata, thoughts } = message;
  const isLoading = message.isLoading ?? false;
  const [expandedUserMessageKey, setExpandedUserMessageKey] = useState<string | null>(null);

  const { streamContent, streamThoughts } = useMessageStream(message.id, isLoading && message.role === 'model');

  const rawThinkingExtraction = extractRawThinkingBlocks(streamContent ? `${content || ''}${streamContent}` : content);
  const effectiveContent = rawThinkingExtraction.content;
  const effectiveThoughts = [thoughts, streamThoughts, rawThinkingExtraction.thoughts].filter(Boolean).join('\n\n');

  const shouldSmooth = isLoading && message.role === 'model';
  const displayedContent = useSmoothStreaming(effectiveContent, shouldSmooth);
  const markdownContent = useMemo(
    () => normalizePreviewableMarkdownContent(displayedContent, { isStreaming: shouldSmooth }),
    [displayedContent, shouldSmooth],
  );
  const shouldOfferUserMessageCollapse =
    message.role === 'user' && !isLoading && shouldCollapseUserMessageContent(displayedContent);
  const userMessageCollapseKey = getUserMessageCollapseKey(message.id, displayedContent);
  const isUserMessageExpanded = expandedUserMessageKey === userMessageCollapseKey;
  const isUserMessageCollapsed = shouldOfferUserMessageCollapse && !isUserMessageExpanded;
  const userMessageCollapseRegionId = `${message.id}-message-text`;
  const collapsedMaxHeight = baseFontSize * USER_MESSAGE_COLLAPSED_LINE_HEIGHT * USER_MESSAGE_COLLAPSE_LINE_THRESHOLD;

  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    let previewTimeout: number | null = null;

    if (prevIsLoadingRef.current && !isLoading) {
      if (appSettings.autoFullscreenHtml && message.role === 'model' && effectiveContent) {
        const previewableBlock = extractPreviewableCodeBlock(effectiveContent);
        if (previewableBlock) {
          previewTimeout = window.setTimeout(() => {
            onOpenHtmlPreview(previewableBlock.content, { initialTrueFullscreen: false });
          }, 100);
        }
      }
    }
    prevIsLoadingRef.current = isLoading;

    return () => {
      if (previewTimeout !== null) {
        clearTimeout(previewTimeout);
      }
    };
  }, [isLoading, appSettings.autoFullscreenHtml, effectiveContent, message.role, onOpenHtmlPreview]);

  // Only show the primary thinking indicator (spinner) if:
  // 1. It is loading
  // 2. There is no content yet
  // 3. There is no audio yet
  // 4. AND either thoughts are disabled OR there are no thoughts (even streamed ones) yet.
  // This prevents showing the spinner here when the MessageThoughts component is already showing it.
  const showPrimaryThinkingIndicator =
    isLoading && !effectiveContent && !audioSrc && (!showThoughts || !effectiveThoughts);

  return (
    <>
      {showPrimaryThinkingIndicator && (
        <div className="flex items-center text-sm text-[var(--theme-bg-model-message-text)] py-1 px-1 opacity-80 animate-pulse">
          <div className="mr-2.5 flex-shrink-0">
            <GoogleSpinner size={14} />
          </div>
          <span className="font-medium">{t('thinking_text')}</span>
        </div>
      )}

      {groundingMetadata || urlContextMetadata ? (
        <GroundedResponse
          messageId={message.id}
          text={displayedContent || ''}
          metadata={groundingMetadata}
          urlContextMetadata={urlContextMetadata}
          isLoading={isLoading}
          onOpenHtmlPreview={onOpenHtmlPreview}
          expandCodeBlocksByDefault={expandCodeBlocksByDefault}
          onImageClick={onImageClick}
          onLiveArtifactFollowUp={onLiveArtifactFollowUp}
          isMermaidRenderingEnabled={isMermaidRenderingEnabled}
          isGraphvizRenderingEnabled={isGraphvizRenderingEnabled}
          themeId={themeId}
          onOpenSidePanel={onOpenSidePanel}
          files={message.files}
        />
      ) : effectiveContent ? (
        <div data-user-message-collapsed={shouldOfferUserMessageCollapse ? String(isUserMessageCollapsed) : undefined}>
          <div
            id={userMessageCollapseRegionId}
            className={isUserMessageCollapsed ? 'overflow-hidden' : undefined}
            style={isUserMessageCollapsed ? { maxHeight: `${collapsedMaxHeight}px` } : undefined}
          >
            <div className={`markdown-body ${isLoading ? 'is-loading' : ''}`} style={{ fontSize: `${baseFontSize}px` }}>
              <LazyMarkdownRenderer
                messageId={message.id}
                content={markdownContent}
                contentPreNormalized={true}
                isLoading={isLoading}
                onImageClick={onImageClick}
                onOpenHtmlPreview={onOpenHtmlPreview}
                onLiveArtifactFollowUp={onLiveArtifactFollowUp}
                expandCodeBlocksByDefault={expandCodeBlocksByDefault}
                isMermaidRenderingEnabled={isMermaidRenderingEnabled}
                isGraphvizRenderingEnabled={isGraphvizRenderingEnabled}
                allowHtml={true}
                themeId={themeId}
                onOpenSidePanel={onOpenSidePanel}
                hideThinkingInContext={appSettings.hideThinkingInContext}
                files={message.files}
              />
            </div>
          </div>

          {shouldOfferUserMessageCollapse && (
            <button
              type="button"
              aria-controls={userMessageCollapseRegionId}
              aria-expanded={isUserMessageExpanded}
              aria-label={isUserMessageExpanded ? t('collapse') : t('expand')}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
              onClick={() =>
                setExpandedUserMessageKey((expandedKey) =>
                  expandedKey === userMessageCollapseKey ? null : userMessageCollapseKey,
                )
              }
            >
              {isUserMessageExpanded ? t('collapse') : t('expand')}
              {isUserMessageExpanded ? (
                <ChevronUp size={15} strokeWidth={2} />
              ) : (
                <ChevronDown size={15} strokeWidth={2} />
              )}
            </button>
          )}
        </div>
      ) : null}
    </>
  );
};
