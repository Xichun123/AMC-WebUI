import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from 'react';

import {
  isBboxSystemInstruction,
  isLiveArtifactsSystemInstruction,
  isHdGuideSystemInstruction,
  loadBboxSystemPrompt,
  loadLiveArtifactsSystemPrompt,
  loadHdGuideSystemPrompt,
  resolveLiveArtifactsPromptTheme,
} from '@/features/prompts/promptRegistry';
import { DEFAULT_SYSTEM_INSTRUCTION } from '@/constants/settingsDefaults';
import { focusChatInput } from '@/utils/chat-input/focus';
import { getLiveArtifactsSystemPromptOverride } from '@/utils/liveArtifactsPromptSettings';
import type { AppSettings, ChatSettings, InputCommand, SavedChatSession } from '@/types';

interface PendingLiveArtifactsPromptActivation {
  systemInstruction: string;
  targetSessionId: string | null;
}

interface LiveArtifactsPromptOverrideState {
  active: boolean;
  targetSessionId: string | null;
}

interface UseAppPromptModesOptions {
  language?: 'en' | 'zh';
  appSettings: {
    systemInstruction?: string | null;
    liveArtifactsPromptMode?: AppSettings['liveArtifactsPromptMode'];
    liveArtifactsSystemPrompt?: string | null;
    liveArtifactsSystemPrompts?: AppSettings['liveArtifactsSystemPrompts'];
  };
  currentThemeId: string;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  activeChat: SavedChatSession | undefined;
  activeSessionId: string | null;
  currentChatSettings: ChatSettings;
  setCurrentChatSettings: (updater: (prev: ChatSettings) => ChatSettings) => void;
  handleSendMessage: (args: { text: string }) => void;
  setCommandedInput: (command: InputCommand) => void;
}

interface LiveArtifactsPromptThemeSyncOptions {
  activeSessionId: string | null;
  appSystemInstruction?: string | null;
  configuredLiveArtifactsSystemPrompt?: string | null;
  currentChatSystemInstruction?: string | null;
  currentThemeId: string;
  loadBuiltInLiveArtifactsPrompt: () => Promise<string>;
  setAppSettings: Dispatch<SetStateAction<AppSettings>>;
  setCurrentChatSettings: (updater: (prev: ChatSettings) => ChatSettings) => void;
}

const useLiveArtifactsPromptThemeSync = ({
  activeSessionId,
  appSystemInstruction,
  configuredLiveArtifactsSystemPrompt,
  currentChatSystemInstruction,
  currentThemeId,
  loadBuiltInLiveArtifactsPrompt,
  setAppSettings,
  setCurrentChatSettings,
}: LiveArtifactsPromptThemeSyncOptions) => {
  useEffect(() => {
    if (!currentThemeId || configuredLiveArtifactsSystemPrompt) {
      return;
    }

    const hasBuiltInLiveArtifactsPrompt =
      isLiveArtifactsSystemInstruction(currentChatSystemInstruction) ||
      isLiveArtifactsSystemInstruction(appSystemInstruction);

    if (!hasBuiltInLiveArtifactsPrompt) {
      return;
    }

    let isStale = false;

    loadBuiltInLiveArtifactsPrompt()
      .then((systemInstruction) => {
        if (isStale) {
          return;
        }

        if (isLiveArtifactsSystemInstruction(appSystemInstruction) && appSystemInstruction !== systemInstruction) {
          setAppSettings((prev) =>
            isLiveArtifactsSystemInstruction(prev.systemInstruction) && prev.systemInstruction !== systemInstruction
              ? { ...prev, systemInstruction }
              : prev,
          );
        }

        if (
          activeSessionId &&
          isLiveArtifactsSystemInstruction(currentChatSystemInstruction) &&
          currentChatSystemInstruction !== systemInstruction
        ) {
          setCurrentChatSettings((prev) =>
            isLiveArtifactsSystemInstruction(prev.systemInstruction) && prev.systemInstruction !== systemInstruction
              ? { ...prev, systemInstruction }
              : prev,
          );
        }
      })
      .catch(() => {});

    return () => {
      isStale = true;
    };
  }, [
    activeSessionId,
    appSystemInstruction,
    configuredLiveArtifactsSystemPrompt,
    currentChatSystemInstruction,
    currentThemeId,
    loadBuiltInLiveArtifactsPrompt,
    setAppSettings,
    setCurrentChatSettings,
  ]);
};

export const useAppPromptModes = ({
  language = 'zh',
  appSettings,
  currentThemeId,
  setAppSettings,
  activeChat,
  activeSessionId,
  currentChatSettings,
  setCurrentChatSettings,
  handleSendMessage,
  setCommandedInput,
}: UseAppPromptModesOptions) => {
  const [pendingLiveArtifactsPromptActivation, setPendingLiveArtifactsPromptActivation] =
    useState<PendingLiveArtifactsPromptActivation | null>(null);
  const [liveArtifactsPromptBusySessionId, setLiveArtifactsPromptBusySessionId] = useState<string | null>(null);
  const [liveArtifactsPromptOverrideState, setLiveArtifactsPromptOverrideState] =
    useState<LiveArtifactsPromptOverrideState | null>(null);
  const liveArtifactsPromptMode = appSettings.liveArtifactsPromptMode ?? 'inline';
  const liveArtifactsPromptTheme = resolveLiveArtifactsPromptTheme(currentThemeId);
  const configuredLiveArtifactsSystemPrompt = getLiveArtifactsSystemPromptOverride(
    appSettings,
    liveArtifactsPromptMode,
  );
  const isConfiguredLiveArtifactsSystemInstruction = useCallback(
    (instruction?: string | null) =>
      isLiveArtifactsSystemInstruction(instruction) ||
      (!!configuredLiveArtifactsSystemPrompt && instruction?.trim() === configuredLiveArtifactsSystemPrompt),
    [configuredLiveArtifactsSystemPrompt],
  );

  const currentLiveArtifactsPromptTargetSessionId = activeSessionId ?? null;
  const liveArtifactsPromptOverrideActive =
    liveArtifactsPromptOverrideState?.targetSessionId === currentLiveArtifactsPromptTargetSessionId
      ? liveArtifactsPromptOverrideState.active
      : null;
  const liveArtifactsPromptBusy = liveArtifactsPromptBusySessionId === currentLiveArtifactsPromptTargetSessionId;
  const persistedLiveArtifactsPromptActive =
    isConfiguredLiveArtifactsSystemInstruction(currentChatSettings.systemInstruction) ||
    isConfiguredLiveArtifactsSystemInstruction(appSettings.systemInstruction);

  const isLiveArtifactsPromptActive = liveArtifactsPromptOverrideActive ?? persistedLiveArtifactsPromptActive;
  const loadBuiltInLiveArtifactsPrompt = useCallback(
    () =>
      liveArtifactsPromptTheme
        ? loadLiveArtifactsSystemPrompt(language, liveArtifactsPromptMode, liveArtifactsPromptTheme)
        : loadLiveArtifactsSystemPrompt(language, liveArtifactsPromptMode),
    [language, liveArtifactsPromptMode, liveArtifactsPromptTheme],
  );

  useLiveArtifactsPromptThemeSync({
    activeSessionId,
    appSystemInstruction: appSettings.systemInstruction,
    configuredLiveArtifactsSystemPrompt,
    currentChatSystemInstruction: currentChatSettings.systemInstruction,
    currentThemeId,
    loadBuiltInLiveArtifactsPrompt,
    setAppSettings,
    setCurrentChatSettings,
  });

  useEffect(() => {
    if (!pendingLiveArtifactsPromptActivation) {
      return;
    }

    const { systemInstruction, targetSessionId } = pendingLiveArtifactsPromptActivation;
    const targetMatches = targetSessionId === null || targetSessionId === activeSessionId;

    if (!targetMatches) {
      return;
    }

    if (activeChat && isConfiguredLiveArtifactsSystemInstruction(activeChat.settings.systemInstruction)) {
      queueMicrotask(() => {
        setPendingLiveArtifactsPromptActivation((current) =>
          current === pendingLiveArtifactsPromptActivation ? null : current,
        );
      });
      return;
    }

    if (!activeSessionId || !activeChat) {
      return;
    }

    setCurrentChatSettings((prev) =>
      isConfiguredLiveArtifactsSystemInstruction(prev.systemInstruction)
        ? prev
        : {
            ...prev,
            systemInstruction,
          },
    );

    queueMicrotask(() => {
      setPendingLiveArtifactsPromptActivation((current) =>
        current === pendingLiveArtifactsPromptActivation ? null : current,
      );
    });
  }, [
    activeChat,
    activeSessionId,
    isConfiguredLiveArtifactsSystemInstruction,
    pendingLiveArtifactsPromptActivation,
    setCurrentChatSettings,
  ]);

  useEffect(() => {
    if (
      !liveArtifactsPromptOverrideState ||
      liveArtifactsPromptOverrideState.targetSessionId !== currentLiveArtifactsPromptTargetSessionId
    ) {
      return;
    }

    const actualActive =
      isConfiguredLiveArtifactsSystemInstruction(currentChatSettings.systemInstruction) ||
      isConfiguredLiveArtifactsSystemInstruction(appSettings.systemInstruction);
    if (actualActive === liveArtifactsPromptOverrideState.active) {
      queueMicrotask(() => {
        setLiveArtifactsPromptOverrideState((current) =>
          current &&
          current.targetSessionId === liveArtifactsPromptOverrideState.targetSessionId &&
          current.active === liveArtifactsPromptOverrideState.active
            ? null
            : current,
        );
        setLiveArtifactsPromptBusySessionId((current) =>
          current === liveArtifactsPromptOverrideState.targetSessionId ? null : current,
        );
      });
    }
  }, [
    appSettings.systemInstruction,
    isConfiguredLiveArtifactsSystemInstruction,
    liveArtifactsPromptOverrideState,
    currentLiveArtifactsPromptTargetSessionId,
    currentChatSettings.systemInstruction,
  ]);

  const activateLiveArtifactsPrompt = useCallback(
    async (targetSessionId: string | null) => {
      const newSystemInstruction = configuredLiveArtifactsSystemPrompt || (await loadBuiltInLiveArtifactsPrompt());

      setPendingLiveArtifactsPromptActivation({
        systemInstruction: newSystemInstruction,
        targetSessionId,
      });
      setAppSettings((prev) => ({ ...prev, systemInstruction: newSystemInstruction }));

      return newSystemInstruction;
    },
    [configuredLiveArtifactsSystemPrompt, loadBuiltInLiveArtifactsPrompt, setAppSettings],
  );

  const handleLoadLiveArtifactsPromptAndSave = useCallback(async () => {
    const targetSessionId = activeSessionId ?? null;

    if (liveArtifactsPromptBusy) {
      return;
    }

    const isCurrentlyLiveArtifactsPrompt = liveArtifactsPromptOverrideActive ?? persistedLiveArtifactsPromptActive;

    setLiveArtifactsPromptBusySessionId(targetSessionId);
    setLiveArtifactsPromptOverrideState({
      active: !isCurrentlyLiveArtifactsPrompt,
      targetSessionId,
    });

    try {
      if (isCurrentlyLiveArtifactsPrompt) {
        setPendingLiveArtifactsPromptActivation(null);
        setAppSettings((prev) => ({ ...prev, systemInstruction: DEFAULT_SYSTEM_INSTRUCTION }));
        if (activeSessionId) {
          setCurrentChatSettings((prev) => ({
            ...prev,
            systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
          }));
        }
      } else {
        await activateLiveArtifactsPrompt(targetSessionId);
      }
    } catch (error) {
      setLiveArtifactsPromptOverrideState((current) =>
        current?.targetSessionId === targetSessionId
          ? { active: isCurrentlyLiveArtifactsPrompt, targetSessionId }
          : current,
      );
      setLiveArtifactsPromptBusySessionId((current) => (current === targetSessionId ? null : current));
      throw error;
    }

    focusChatInput();
  }, [
    activateLiveArtifactsPrompt,
    activeSessionId,
    liveArtifactsPromptBusy,
    liveArtifactsPromptOverrideActive,
    persistedLiveArtifactsPromptActive,
    setAppSettings,
    setCurrentChatSettings,
  ]);

  const setCodePromptModeSettings = useCallback(
    (systemInstruction: string, isCodeExecutionEnabled: boolean) => {
      setAppSettings((prev) => ({
        ...prev,
        systemInstruction,
        isCodeExecutionEnabled,
      }));
      if (activeSessionId) {
        setCurrentChatSettings((prev) => ({
          ...prev,
          systemInstruction,
          isCodeExecutionEnabled,
        }));
      }
    },
    [activeSessionId, setAppSettings, setCurrentChatSettings],
  );

  const toggleCodePromptMode = useCallback(
    async (isCurrentlyActive: boolean, loadPrompt: () => Promise<string>) => {
      if (isCurrentlyActive) {
        setCodePromptModeSettings(DEFAULT_SYSTEM_INSTRUCTION, false);
        return;
      }

      setCodePromptModeSettings(await loadPrompt(), true);
    },
    [setCodePromptModeSettings],
  );

  const handleToggleBBoxMode = useCallback(async () => {
    await toggleCodePromptMode(isBboxSystemInstruction(currentChatSettings.systemInstruction), loadBboxSystemPrompt);
  }, [currentChatSettings.systemInstruction, toggleCodePromptMode]);

  const handleToggleGuideMode = useCallback(async () => {
    await toggleCodePromptMode(
      isHdGuideSystemInstruction(currentChatSettings.systemInstruction),
      loadHdGuideSystemPrompt,
    );
  }, [currentChatSettings.systemInstruction, toggleCodePromptMode]);

  const handleSuggestionClick = useCallback(
    async (type: 'homepage' | 'organize' | 'follow-up' | 'follow-up-fill', text: string) => {
      if (type === 'organize') {
        setLiveArtifactsPromptOverrideState({
          active: true,
          targetSessionId: currentLiveArtifactsPromptTargetSessionId,
        });

        if (!isConfiguredLiveArtifactsSystemInstruction(currentChatSettings.systemInstruction)) {
          await activateLiveArtifactsPrompt(activeSessionId);
        }

        setCommandedInput({ text: `${text}\n`, id: Date.now(), mode: 'replace' });
        focusChatInput(0);
        return;
      }

      if (type === 'follow-up') {
        handleSendMessage({ text });
        return;
      }

      setCommandedInput({ text: `${text}\n`, id: Date.now() });
      focusChatInput(0);
    },
    [
      activeSessionId,
      activateLiveArtifactsPrompt,
      currentLiveArtifactsPromptTargetSessionId,
      currentChatSettings.systemInstruction,
      handleSendMessage,
      isConfiguredLiveArtifactsSystemInstruction,
      setCommandedInput,
    ],
  );

  return {
    handleLoadLiveArtifactsPromptAndSave,
    handleToggleBBoxMode,
    handleToggleGuideMode,
    handleSuggestionClick,
    isLiveArtifactsPromptActive,
    isLiveArtifactsPromptBusy: liveArtifactsPromptBusy,
  };
};
