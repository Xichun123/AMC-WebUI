import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import { type AppSettings, type SavedChatSession } from '@/types';
import { logService } from '@/services/logService';
import { getGeminiKeyForRequest } from '@/utils/apiKeySelection';
import { generateSessionTitle } from '@/utils/chat/session';
import { generateTitleApi } from '@/services/api/generation/textApi';
import { getVisibleChatMessages } from '@/utils/chat/visibility';
import { isOpenAICompatibleApiActive } from '@/utils/openaiCompatibleMode';

type SessionsUpdater = (updater: (prev: SavedChatSession[]) => SavedChatSession[]) => void;

interface AutoTitlingProps {
  appSettings: AppSettings;
  activeChat?: SavedChatSession;
  updateAndPersistSessions: SessionsUpdater;
  language: 'en' | 'zh';
  generatingTitleSessionIds: Set<string>;
  setGeneratingTitleSessionIds: Dispatch<SetStateAction<Set<string>>>;
  sessionKeyMapRef?: MutableRefObject<Map<string, string>>;
}

const hashAttemptValue = (value: string | null | undefined): string => {
  const text = value ?? '';
  let hash = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `${text.length}:${(hash >>> 0).toString(36)}`;
};

const buildAutoTitleAttemptKey = (
  session: SavedChatSession,
  appSettings: AppSettings,
  language: 'en' | 'zh',
): string => {
  const messages = getVisibleChatMessages(session.messages);
  const firstMessage = messages[0];
  const secondMessage = messages[1];
  const messageKey = (message: (typeof messages)[number] | undefined) =>
    message
      ? [
          message.id,
          message.role,
          message.isLoading ? 'loading' : 'idle',
          message.stoppedByUser ? 'stopped' : 'active',
          hashAttemptValue(message.content),
        ].join(':')
      : 'none';

  return [
    session.id,
    hashAttemptValue(session.title),
    messageKey(firstMessage),
    messageKey(secondMessage),
    hashAttemptValue(session.settings.lockedApiKey),
    language,
    appSettings.apiMode,
    appSettings.isOpenAICompatibleApiEnabled ? 'openai-compatible' : 'gemini-native',
    appSettings.useCustomApiConfig ? 'custom-api' : 'env-api',
    appSettings.serverManagedApi ? 'server-managed' : 'browser-managed',
    appSettings.useApiProxy ? 'proxy' : 'direct',
    hashAttemptValue(appSettings.apiKey),
    hashAttemptValue(appSettings.apiProxyUrl),
  ].join('|');
};

export const useAutoTitling = ({
  appSettings,
  activeChat,
  updateAndPersistSessions,
  language,
  generatingTitleSessionIds,
  setGeneratingTitleSessionIds,
  sessionKeyMapRef,
}: AutoTitlingProps) => {
  const attemptedTitleKeysRef = useRef<Set<string>>(new Set());

  const generateTitleForSession = useCallback(
    async (session: SavedChatSession) => {
      const sessionId = session.id;
      const messages = getVisibleChatMessages(session.messages);
      if (messages.length < 2) return;

      setGeneratingTitleSessionIds((prev) => new Set(prev).add(sessionId));
      logService.info(`Auto-generating title for session ${sessionId}`);

      const stickyKey = isOpenAICompatibleApiActive(appSettings)
        ? undefined
        : sessionKeyMapRef?.current?.get(sessionId);

      let keyToUse: string;
      if (stickyKey) {
        keyToUse = stickyKey;
      } else {
        const keyResult = getGeminiKeyForRequest(appSettings, session.settings, { skipIncrement: true });
        if ('error' in keyResult) {
          logService.error(`Could not generate title for session ${sessionId}: ${keyResult.error}`);
          setGeneratingTitleSessionIds((prev) => {
            const next = new Set(prev);
            next.delete(sessionId);
            return next;
          });
          return;
        }
        keyToUse = keyResult.key;
      }

      try {
        const userContent = messages[0].content;
        const modelContent = messages[1].content;

        if (!userContent.trim() && !modelContent.trim()) {
          logService.info(`Skipping title generation for session ${sessionId} due to empty content.`);
          return;
        }

        const newTitle = await generateTitleApi(keyToUse, userContent, modelContent, language);

        if (newTitle && newTitle.trim()) {
          logService.info(`Generated new title for session ${sessionId}: "${newTitle}"`);
          updateAndPersistSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s)),
          );
        } else {
          logService.warn(`Title generation for session ${sessionId} returned an empty string.`);
        }
      } catch (error) {
        logService.error(`Failed to auto-generate title for session ${sessionId}`, { error });
        const localTitle = generateSessionTitle(messages);
        if (localTitle && localTitle !== 'New Chat') {
          updateAndPersistSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: localTitle } : s)));
        }
      } finally {
        setGeneratingTitleSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    },
    [appSettings, updateAndPersistSessions, language, setGeneratingTitleSessionIds, sessionKeyMapRef],
  );

  useEffect(() => {
    if (!appSettings.isAutoTitleEnabled || !activeChat) return;

    const visibleMessages = getVisibleChatMessages(activeChat.messages);

    const isNewChat = activeChat.title === 'New Chat';
    const isPlaceholder = activeChat.title === generateSessionTitle(activeChat.messages);

    if (!isNewChat && !isPlaceholder) return;

    if (generatingTitleSessionIds.has(activeChat.id)) return;

    if (visibleMessages.length < 2) return;

    const firstMsg = visibleMessages[0];
    const secondMsg = visibleMessages[1];

    if (firstMsg.role !== 'user' || secondMsg.role !== 'model') return;

    if (secondMsg.isLoading || secondMsg.stoppedByUser) return;

    const attemptKey = buildAutoTitleAttemptKey(activeChat, appSettings, language);
    if (attemptedTitleKeysRef.current.has(attemptKey)) return;
    attemptedTitleKeysRef.current.add(attemptKey);

    generateTitleForSession(activeChat);
  }, [activeChat, appSettings, generatingTitleSessionIds, generateTitleForSession, language]);
};
