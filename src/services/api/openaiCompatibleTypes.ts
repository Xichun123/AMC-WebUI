import type { UsageMetadata } from '@google/genai';

export interface OpenAICompatibleChatConfig {
  baseUrl?: string | null;
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
}

export type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'input_audio'; input_audio: { data: string; format: string } }
    >;

export type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: OpenAIMessageContent;
};

export type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type OpenAIChoice = {
  message?: {
    content?: string | Array<{ text?: string }>;
    reasoning_content?: string;
  };
  delta?: {
    content?: string;
    reasoning_content?: string;
  };
};

export type OpenAIResponsePayload = {
  choices?: OpenAIChoice[];
  usage?: OpenAIUsage;
  error?: {
    message?: string;
  };
};

export type OpenAIModelsResponsePayload = {
  data?: Array<{
    id?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

export const asOpenAICompatibleConfig = (config: unknown): OpenAICompatibleChatConfig =>
  typeof config === 'object' && config !== null ? (config as OpenAICompatibleChatConfig) : {};

export const mapOpenAICompatibleUsage = (usage?: OpenAIUsage): UsageMetadata | undefined => {
  if (!usage) {
    return undefined;
  }

  return {
    promptTokenCount: usage.prompt_tokens,
    candidatesTokenCount: usage.completion_tokens,
    totalTokenCount: usage.total_tokens,
  } as UsageMetadata;
};
