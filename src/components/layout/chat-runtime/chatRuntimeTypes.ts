import type { DragEvent, ReactNode } from 'react';
import type { Part } from '@google/genai';

import type { AppViewModel } from '@/hooks/app/useApp';
import type {
  ChatSettingsUpdater,
  LiveClientFunctions,
  MediaResolution,
  ModelOption,
  SideViewContent,
  ThinkingLevel,
  UploadedFile,
  VideoMetadata,
} from '@/types';

export interface ChatHeaderRuntimeValue {
  isAppDraggingOver: boolean;
  modelsLoadingError: string | null;
  handleAppDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  handleAppDragOver: (event: DragEvent<HTMLDivElement>) => void;
  handleAppDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  handleAppDrop: (event: DragEvent<HTMLDivElement>) => void;
  currentModelName: string;
  availableModels: ModelOption[];
  selectedModelId: string;
  isLiveArtifactsPromptActive: boolean;
  isLiveArtifactsPromptBusy: boolean;
  isPipSupported: boolean;
  isPipActive: boolean;
  onNewChat: () => void;
  onOpenScenariosModal: () => void;
  onToggleHistorySidebar: () => void;
  onLoadLiveArtifactsPrompt: () => void;
  onSelectModel: (modelId: string) => void;
  onSetThinkingLevel: (level: ThinkingLevel) => void;
  onToggleGemmaReasoning: () => void;
  onTogglePip: () => void;
}

export interface ChatMessageListRuntimeValue {
  sessionTitle: string;
  setScrollContainerRef: (node: HTMLDivElement | null) => void;
  onEditMessage: (messageId: string, mode?: 'update' | 'resend') => void;
  onDeleteMessage: (messageId: string) => void;
  onRetryMessage: (messageId: string) => void;
  onUpdateMessageFile: (
    messageId: string,
    fileId: string,
    updates: { videoMetadata?: VideoMetadata; mediaResolution?: MediaResolution },
  ) => void;
  onFollowUpSuggestionClick: (suggestion: string) => void;
  onFollowUpSuggestionFill: (suggestion: string) => void;
  onContinueGeneration: (messageId: string) => void;
  onForkMessage: (messageId: string) => void;
  onQuickTTS: (text: string) => Promise<string | null>;
  onOpenSidePanel: (content: SideViewContent) => void;
}

export interface ChatInputRuntimeValue {
  onMessageSent: () => void;
  onSendMessage: (text: string, options?: { isFastMode?: boolean; files?: UploadedFile[] }) => void;
  onStopGenerating: () => void;
  onCancelEdit: () => void;
  onProcessFiles: (files: FileList | File[]) => Promise<void>;
  onAddFileById: (fileId: string) => Promise<void>;
  onCancelUpload: (fileId: string) => void;
  onTranscribeAudio: (file: File) => Promise<string | null>;
  onClearChat: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onToggleLiveArtifactsPrompt: () => void;
  onTogglePinCurrentSession: () => void;
  onRetryLastTurn: () => void;
  onSelectModel: (modelId: string) => void;
  availableModels: ModelOption[];
  onEditLastUserMessage: () => void;
  onTogglePip: () => void;
  isPipActive: boolean;
  onToggleQuadImages: () => void;
  setCurrentChatSettings: ChatSettingsUpdater;
  onSuggestionClick: (suggestion: string) => void;
  onOrganizeInfoClick: (suggestion: string) => void;
  onAddUserMessage: (text: string, files?: UploadedFile[]) => void;
  onLiveTranscript?: (
    text: string,
    role: 'user' | 'model',
    isFinal: boolean,
    type?: 'content' | 'thought',
    audioUrl?: string | null,
    generatedFiles?: UploadedFile[],
    apiPart?: Part,
  ) => void;
  liveClientFunctions?: LiveClientFunctions;
  onEditMessageContent: (messageId: string, content: string) => void;
  onToggleBBox: () => void;
  onToggleGuide: () => void;
}

export interface ChatRuntimeValues {
  header: ChatHeaderRuntimeValue;
  messageList: ChatMessageListRuntimeValue;
  input: ChatInputRuntimeValue;
}

export interface ChatRuntimeProviderProps {
  app: AppViewModel;
  children: ReactNode;
}

export interface ChatRuntimeValuesProviderProps {
  value: ChatRuntimeValues;
  children: ReactNode;
}
