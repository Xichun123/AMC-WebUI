import { useMemo } from 'react';
import { type ChatSettings, type LiveClientFunctions, type ThinkingLevel } from '@/types';
import type { Tool } from '@google/genai';
import { LOCAL_PYTHON_SYSTEM_PROMPT } from '@/features/prompts/localPython';
import { getCachedModelCapabilities } from '@/stores/modelCapabilitiesStore';
import { buildLiveTranslateConfig } from './useLiveTranslateConfig';

interface UseLiveConfigProps {
  chatSettings: ChatSettings;
  sessionHandle: string | null;
  clientFunctions?: LiveClientFunctions;
  liveTranslateConfig?: {
    targetLanguageCode: string;
    echoTargetLanguage: boolean;
  };
}

export interface LiveConfig {
  responseModalities: ['AUDIO'];
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: string;
      };
    };
  };
  systemInstruction?: { parts: Array<{ text: string }> };
  tools?: Tool[];
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  contextWindowCompression: {
    slidingWindow: Record<string, never>;
  };
  sessionResumption: { handle: string } | Record<string, never>;
  mediaResolution?: ChatSettings['mediaResolution'];
  thinkingConfig?: {
    includeThoughts: boolean;
    thinkingLevel?: ThinkingLevel;
    thinkingBudget?: number;
  };
}

export const useLiveConfig = ({
  chatSettings,
  sessionHandle,
  clientFunctions,
  liveTranslateConfig,
}: UseLiveConfigProps) => {
  return useMemo(() => {
    const capabilities = getCachedModelCapabilities(chatSettings.modelId);

    // Live Translate 模型走专用 config：translationConfig + transcription，
    // 无 voiceConfig / tools / compression / thinking
    if (capabilities.isLiveTranslate) {
      const { targetLanguageCode, echoTargetLanguage } = liveTranslateConfig ?? {
        targetLanguageCode: 'en',
        echoTargetLanguage: false,
      };
      return {
        liveConfig: buildLiveTranslateConfig({ targetLanguageCode, echoTargetLanguage }),
        tools: [] as Tool[],
      };
    }

    const isGemini31FlashLive = capabilities.isGemini31FlashLiveModel;

    // Construct Tools Configuration
    const tools: Tool[] = [];

    // Server-side tools
    if (chatSettings.isGoogleSearchEnabled || chatSettings.isDeepSearchEnabled) {
      tools.push({ googleSearch: {} });
    }

    const functionDeclarations = Object.values(clientFunctions ?? {}).map(({ declaration }) => declaration);
    if (functionDeclarations.length > 0) {
      tools.push({ functionDeclarations });
    }

    const hasLocalPythonTool = functionDeclarations.some((declaration) => declaration.name === 'run_local_python');
    const effectiveSystemInstruction = hasLocalPythonTool
      ? chatSettings.systemInstruction
        ? `${chatSettings.systemInstruction}\n\n${LOCAL_PYTHON_SYSTEM_PROMPT}`
        : LOCAL_PYTHON_SYSTEM_PROMPT
      : chatSettings.systemInstruction;

    const liveConfig: LiveConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: chatSettings.ttsVoice || 'Zephyr' } },
      },
      systemInstruction: effectiveSystemInstruction ? { parts: [{ text: effectiveSystemInstruction }] } : undefined,
      tools: tools.length > 0 ? tools : undefined,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: {
        slidingWindow: {},
      },
      // Enable session resumption from the first connection so the server
      // can start issuing handle updates immediately.
      sessionResumption: sessionHandle ? { handle: sessionHandle } : {},
      mediaResolution: chatSettings.mediaResolution,
    };

    // Configure Thinking for Native Audio models if enabled in settings
    // Gemini 3.1 Flash Live uses thinkingLevel; Gemini 2.5 native audio/live
    // models still use thinkingBudget.
    if (isGemini31FlashLive) {
      liveConfig.thinkingConfig = {
        includeThoughts: true,
        thinkingLevel: chatSettings.thinkingLevel || 'MINIMAL',
      };
    } else if (chatSettings.thinkingBudget !== 0) {
      const thinkingConfig: NonNullable<LiveConfig['thinkingConfig']> = {
        includeThoughts: true,
      };
      if (chatSettings.thinkingBudget > 0) {
        thinkingConfig.thinkingBudget = chatSettings.thinkingBudget;
      }
      liveConfig.thinkingConfig = thinkingConfig;
    }

    return { liveConfig, tools };
  }, [chatSettings, sessionHandle, clientFunctions, liveTranslateConfig]);
};
