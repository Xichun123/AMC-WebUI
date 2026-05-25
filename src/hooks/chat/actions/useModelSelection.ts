import { type MutableRefObject, useCallback } from 'react';
import { type AppSettings, type ChatSettings as IndividualChatSettings, type SavedChatSession } from '@/types';
import { DEFAULT_CHAT_SETTINGS } from '@/constants/settingsDefaults';
import { createNewSession } from '@/utils/chat/session';
import { focusChatInput } from '@/utils/chat-input/focus';
import { resolveModelSwitchSettings } from '@/utils/modelSwitchSettings';

interface UseModelSelectionProps {
  appSettings: AppSettings;
  activeSessionId: string | null;
  currentChatSettings: IndividualChatSettings;
  isLoading: boolean;
  updateAndPersistSessions: (
    updater: (prev: SavedChatSession[]) => SavedChatSession[],
    options?: { persist?: boolean },
  ) => void;
  setActiveSessionId: (id: string | null) => void;
  setCurrentChatSettings: (updater: (prevSettings: IndividualChatSettings) => IndividualChatSettings) => void;
  setIsSwitchingModel: (switching: boolean) => void;
  handleStopGenerating: () => void;
  userScrolledUpRef: MutableRefObject<boolean>;
}

const hasResolvedModelSettingChanges = (
  currentSettings: IndividualChatSettings,
  resolvedModelSettings: Partial<IndividualChatSettings>,
): boolean =>
  currentSettings.thinkingBudget !== resolvedModelSettings.thinkingBudget ||
  currentSettings.thinkingLevel !== resolvedModelSettings.thinkingLevel;

export const useModelSelection = ({
  appSettings,
  activeSessionId,
  currentChatSettings,
  isLoading,
  updateAndPersistSessions,
  setActiveSessionId,
  setCurrentChatSettings,
  setIsSwitchingModel,
  handleStopGenerating,
  userScrolledUpRef,
}: UseModelSelectionProps) => {
  const handleSelectModelInHeader = useCallback(
    (modelId: string) => {
      const sourceSettings = activeSessionId ? currentChatSettings : appSettings;
      const resolvedModelSettings: Partial<IndividualChatSettings> = resolveModelSwitchSettings({
        currentSettings: currentChatSettings,
        sourceSettings,
        targetModelId: modelId,
      });

      if (!activeSessionId) {
        const sessionSettings = { ...DEFAULT_CHAT_SETTINGS, ...appSettings, ...resolvedModelSettings };
        const newSession = createNewSession(sessionSettings);

        updateAndPersistSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      } else {
        if (isLoading) handleStopGenerating();
        if (modelId !== currentChatSettings.modelId) {
          setIsSwitchingModel(true);
          updateAndPersistSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId ? { ...s, settings: { ...s.settings, ...resolvedModelSettings } } : s,
            ),
          );
        } else if (hasResolvedModelSettingChanges(currentChatSettings, resolvedModelSettings)) {
          setCurrentChatSettings((prev) => ({
            ...prev,
            thinkingBudget: resolvedModelSettings.thinkingBudget ?? prev.thinkingBudget,
            thinkingLevel: resolvedModelSettings.thinkingLevel,
          }));
        }
      }
      userScrolledUpRef.current = false;
      focusChatInput();
    },
    [
      isLoading,
      currentChatSettings,
      updateAndPersistSessions,
      activeSessionId,
      userScrolledUpRef,
      handleStopGenerating,
      appSettings,
      setActiveSessionId,
      setCurrentChatSettings,
      setIsSwitchingModel,
    ],
  );

  return { handleSelectModelInHeader };
};
