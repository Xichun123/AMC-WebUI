import { DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import { sanitizeSessionModel as sanitizeSessionModelWithFallback, sortSessionsInPlace } from '@/stores/sessionModels';
import type { AppSettings, ChatSettings, SavedChatSession } from '@/types';

export const sortSessionsByPinnedAndTimestamp = (sessions: SavedChatSession[]) => sortSessionsInPlace([...sessions]);

export const sanitizeSessionModel = (session: SavedChatSession): SavedChatSession =>
  sanitizeSessionModelWithFallback(session, DEFAULT_CHAT_SETTINGS.modelId);

const getMostRecentTemplateSession = (sessions: SavedChatSession[], excludeSessionId?: string | null) =>
  [...sessions]
    .filter((session) => session.id !== excludeSessionId)
    .sort((leftSession, rightSession) => rightSession.timestamp - leftSession.timestamp)[0];

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
