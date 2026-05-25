import type { SavedChatSession, UploadedFile } from '@/types';
import { cleanupFilePreviewUrls } from '@/utils/filePreviewUrls';

export const toSessionMetadata = (session: SavedChatSession): SavedChatSession => ({ ...session, messages: [] });

export const retainRuntimeSession = (
  sessions: SavedChatSession[],
  activeSessionId: string,
  runtimeSession: SavedChatSession,
) => {
  const exists = sessions.some((session) => session.id === activeSessionId);

  if (exists) {
    return sessions.map((session) =>
      session.id === activeSessionId ? { ...session, ...runtimeSession, messages: runtimeSession.messages } : session,
    );
  }

  return [runtimeSession, ...sessions];
};

export const storeSessionDraftFiles = (
  fileDrafts: Record<string, UploadedFile[]>,
  sessionId: string,
  selectedFiles: UploadedFile[],
) => {
  fileDrafts[sessionId] = selectedFiles;
};

export const clearSessionDraftFiles = (fileDrafts: Record<string, UploadedFile[]>, sessionId: string) => {
  fileDrafts[sessionId] = [];
};

export const getSessionDraftFiles = (fileDrafts: Record<string, UploadedFile[]>, sessionId: string) =>
  fileDrafts[sessionId] || [];

export const cleanupSessionFilePreviews = (session?: SavedChatSession) => {
  session?.messages.forEach((message) => cleanupFilePreviewUrls(message.files));
};
