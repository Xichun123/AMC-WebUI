import React, { useMemo } from 'react';
import { AttachmentMenu } from './AttachmentMenu';
import { ToolsMenu } from './ToolsMenu';
import { WebSearchToggle } from './actions/WebSearchToggle';
import { LiveControls } from './actions/LiveControls';
import { RecordControls } from './actions/RecordControls';
import { ComposerAuxiliaryButtons } from './actions/ComposerAuxiliaryButtons';
import { SendControls } from './actions/SendControls';
import { ComposerMoreMenu } from './actions/ComposerMoreMenu';
import { useComposerAuxiliaryActions } from './actions/useComposerAuxiliaryActions';
import { useAuxiliaryActionCollapse } from './actions/useAuxiliaryActionCollapse';
import { useChatInputActionsContext, useChatInputComposerStatusContext } from './ChatInputContext';

const ChatInputActionsComponent: React.FC = () => {
  const {
    disabled,
    isWaitingForUpload,
    onToggleFullscreen,
    isLiveConnected,
    isNativeAudioModel,
    onToggleToolAndFocus,
    onCountTokens,
    currentModelId,
    toolStates,
    isLoading,
    isEditing,
  } = useChatInputActionsContext();
  const { canQueueMessage } = useChatInputComposerStatusContext();
  const focusedToolStates = useMemo(
    () => ({
      googleSearch: {
        isEnabled: !!toolStates.googleSearch?.isEnabled,
        onToggle: toolStates.googleSearch?.onToggle
          ? () => onToggleToolAndFocus(toolStates.googleSearch!.onToggle!)
          : undefined,
      },
      codeExecution: {
        isEnabled: !!toolStates.codeExecution?.isEnabled,
        onToggle: toolStates.codeExecution?.onToggle
          ? () => onToggleToolAndFocus(toolStates.codeExecution!.onToggle!)
          : undefined,
      },
      localPython: {
        isEnabled: !!toolStates.localPython?.isEnabled,
        onToggle: toolStates.localPython?.onToggle
          ? () => onToggleToolAndFocus(toolStates.localPython!.onToggle!)
          : undefined,
      },
      urlContext: {
        isEnabled: !!toolStates.urlContext?.isEnabled,
        onToggle: toolStates.urlContext?.onToggle
          ? () => onToggleToolAndFocus(toolStates.urlContext!.onToggle!)
          : undefined,
      },
      deepSearch: {
        isEnabled: !!toolStates.deepSearch?.isEnabled,
        onToggle: toolStates.deepSearch?.onToggle
          ? () => onToggleToolAndFocus(toolStates.deepSearch!.onToggle!)
          : undefined,
      },
    }),
    [onToggleToolAndFocus, toolStates],
  );
  const toolUtilityActions = useMemo(
    () => ({
      onCountTokens,
    }),
    [onCountTokens],
  );
  const auxiliaryActions = useComposerAuxiliaryActions();
  const auxiliaryActionSignature = useMemo(
    () => auxiliaryActions.map((action) => `${action.id}:${action.disabled}`).join('|'),
    [auxiliaryActions],
  );
  const hasComposerMoreActions = auxiliaryActions.length > 0;
  const measurementSignature = useMemo(
    () =>
      [
        hasComposerMoreActions,
        isNativeAudioModel,
        isLiveConnected,
        !!onToggleFullscreen,
        auxiliaryActionSignature,
        isLoading,
        isEditing,
        isWaitingForUpload,
        canQueueMessage,
      ].join('|'),
    [
      canQueueMessage,
      hasComposerMoreActions,
      isEditing,
      isLiveConnected,
      isLoading,
      isNativeAudioModel,
      isWaitingForUpload,
      onToggleFullscreen,
      auxiliaryActionSignature,
    ],
  );
  const { rootRef, leftActionsRef, rightActionsRef, shouldCollapseAuxiliaryActions } = useAuxiliaryActionCollapse({
    hasAuxiliaryActions: hasComposerMoreActions,
    measurementSignature,
  });
  const showAuxiliaryActionsInMenu = hasComposerMoreActions && shouldCollapseAuxiliaryActions;

  return (
    <div
      ref={rootRef}
      data-testid="chat-input-actions-root"
      className="flex w-full items-center justify-between gap-2 overflow-visible"
    >
      <div
        ref={leftActionsRef}
        data-testid="chat-input-actions-left"
        className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <AttachmentMenu />

        {isNativeAudioModel && (
          <WebSearchToggle
            isGoogleSearchEnabled={!!focusedToolStates.googleSearch?.isEnabled}
            onToggleGoogleSearch={focusedToolStates.googleSearch?.onToggle ?? (() => undefined)}
            disabled={disabled}
          />
        )}

        <ToolsMenu
          currentModelId={currentModelId}
          toolStates={focusedToolStates}
          toolUtilityActions={toolUtilityActions}
          disabled={disabled}
        />
      </div>

      <div
        ref={rightActionsRef}
        data-testid="chat-input-actions-right"
        className="flex min-w-0 flex-shrink-0 items-center gap-1.5 sm:gap-3"
      >
        {!isLiveConnected && !isNativeAudioModel && <RecordControls />}

        {!showAuxiliaryActionsInMenu && auxiliaryActions.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3">
            <ComposerAuxiliaryButtons actions={auxiliaryActions} />
          </div>
        )}

        {showAuxiliaryActionsInMenu && (
          <div>
            <ComposerMoreMenu
              actions={auxiliaryActions}
              disabled={disabled && auxiliaryActions.every((action) => action.disabled)}
            />
          </div>
        )}

        {isNativeAudioModel && <LiveControls />}

        <SendControls />
      </div>
    </div>
  );
};

export const ChatInputActions = React.memo(ChatInputActionsComponent);
