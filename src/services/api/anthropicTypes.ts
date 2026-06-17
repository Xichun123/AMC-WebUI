import type { UsageMetadata } from '@google/genai';

export interface AnthropicChatConfig {
  baseUrl?: string | null;
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

// Non-stream response
export type AnthropicResponsePayload = {
  id?: string;
  role?: string;
  content?: Array<{ type?: string; text?: string }>;
  model?: string;
  usage?: AnthropicUsage;
  error?: { message?: string };
};

// SSE stream event payload (message_start / content_block_delta / message_delta etc.)
export type AnthropicStreamEvent = {
  type: string;
  message?: AnthropicResponsePayload;
  delta?: { type?: string; text?: string };
  usage?: AnthropicUsage;
};

export type AnthropicModelsResponsePayload = {
  data?: Array<{ id?: unknown }>;
  error?: { message?: string };
};

export const asAnthropicChatConfig = (config: unknown): AnthropicChatConfig =>
  typeof config === 'object' && config !== null ? (config as AnthropicChatConfig) : {};

export const mapAnthropicUsage = (usage?: AnthropicUsage): UsageMetadata | undefined => {
  if (!usage) {
    return undefined;
  }
  const prompt = usage.input_tokens ?? 0;
  const completion = usage.output_tokens ?? 0;
  return {
    promptTokenCount: prompt,
    candidatesTokenCount: completion,
    totalTokenCount: prompt + completion,
  } as UsageMetadata;
};
