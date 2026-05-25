import { DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import type { AppSettings, ChatSettings, SavedChatSession } from '@/types';
import { resolveSupportedModelId } from '@/utils/modelSorting';

export const sortSessionsByPinnedAndTimestamp = (sessions: SavedChatSession[]) =>
  [...sessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.timestamp - a.timestamp;
  });

export const sanitizeSessionModel = (session: SavedChatSession): SavedChatSession => ({
  ...session,
  settings: {
    ...session.settings,
    modelId: resolveSupportedModelId(session.settings?.modelId, DEFAULT_CHAT_SETTINGS.modelId),
  },
});

const getMostRecentTemplateSession = (sessions: SavedChatSession[], excludeSessionId?: string | null) =>
  [...sessions].filter((session) => session.id !== excludeSessionId).sort((a, b) => b.timestamp - a.timestamp)[0];

interface CreateSettingsForNewChatOptions {
  appSettings: AppSettings;
  savedSessions: SavedChatSession[];
  explicitTemplateSession?: SavedChatSession;
  excludeTemplateSessionId?: string | null;
}

export const createSettingsForNewChat = ({
  appSettings,
  savedSessions,
  explicitTemplateSession,
  excludeTemplateSessionId,
}: CreateSettingsForNewChatOptions): ChatSettings => {
  let settingsForNewChat: ChatSettings = {
    ...DEFAULT_CHAT_SETTINGS,
    ...appSettings,
    lockedApiKey: null,
  };

  const templateSession =
    explicitTemplateSession || getMostRecentTemplateSession(savedSessions, excludeTemplateSessionId);

  if (templateSession) {
    const sanitizedTemplate = sanitizeSessionModel(templateSession);
    settingsForNewChat = {
      ...settingsForNewChat,
      modelId: sanitizedTemplate.settings.modelId,
      isGoogleSearchEnabled: sanitizedTemplate.settings.isGoogleSearchEnabled,
      isCodeExecutionEnabled: sanitizedTemplate.settings.isCodeExecutionEnabled,
      isUrlContextEnabled: sanitizedTemplate.settings.isUrlContextEnabled,
      isDeepSearchEnabled: sanitizedTemplate.settings.isDeepSearchEnabled,
      thinkingBudget: sanitizedTemplate.settings.thinkingBudget,
      thinkingLevel: sanitizedTemplate.settings.thinkingLevel,
      ttsVoice: sanitizedTemplate.settings.ttsVoice,
    };
  }

  return settingsForNewChat;
};
