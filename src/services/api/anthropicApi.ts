import type { UsageMetadata } from '@google/genai';
import type { ModelOption, NonStreamMessageSender, StreamMessageSender } from '@/types';
import { logService } from '@/services/logService';
import { buildAnthropicRequestBody } from './anthropicMessages';
import { extractAnthropicMessageText, readAnthropicErrorMessage } from './anthropicResponses';
import { readAnthropicStreamEvents } from './anthropicStream';
import {
  asAnthropicChatConfig,
  mapAnthropicUsage,
  type AnthropicModelsResponsePayload,
  type AnthropicResponsePayload,
  type AnthropicStreamEvent,
} from './anthropicTypes';
import { buildAnthropicMessagesUrl, buildAnthropicModelsUrl } from './anthropicUrls';

const ANTHROPIC_VERSION = '2023-06-01';

const createRequestInit = (apiKey: string, body: Record<string, unknown>, abortSignal: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
  signal: abortSignal,
});

const createGetRequestInit = (apiKey: string, abortSignal: AbortSignal): RequestInit => ({
  method: 'GET',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  },
  signal: abortSignal,
});

export const fetchAnthropicModels = async (
  apiKey: string,
  baseUrl: string | null | undefined,
  abortSignal: AbortSignal,
): Promise<ModelOption[]> => {
  const response = await fetch(buildAnthropicModelsUrl(baseUrl), createGetRequestInit(apiKey, abortSignal));
  if (!response.ok) {
    throw new Error(await readAnthropicErrorMessage(response));
  }
  const payload = (await response.json()) as AnthropicModelsResponsePayload;
  const seenIds = new Set<string>();
  return (payload.data ?? []).reduce<ModelOption[]>((models, item) => {
    const modelId = typeof item.id === 'string' ? item.id.trim() : '';
    if (!modelId || seenIds.has(modelId)) return models;
    seenIds.add(modelId);
    models.push({ id: modelId, name: modelId });
    return models;
  }, []);
};

export const sendAnthropicMessageNonStream: NonStreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onError,
  onComplete,
  role = 'user',
) => {
  const anthropicConfig = asAnthropicChatConfig(config);
  try {
    if (abortSignal.aborted) {
      onComplete([], undefined, undefined, undefined, undefined);
      return;
    }
    const response = await fetch(
      buildAnthropicMessagesUrl(anthropicConfig.baseUrl),
      createRequestInit(
        apiKey,
        buildAnthropicRequestBody(modelId, history, parts, anthropicConfig, role, false),
        abortSignal,
      ),
    );
    if (!response.ok) {
      throw new Error(await readAnthropicErrorMessage(response));
    }
    const payload = (await response.json()) as AnthropicResponsePayload;
    if (abortSignal.aborted) {
      onComplete([], undefined, undefined, undefined, undefined);
      return;
    }
    const text = extractAnthropicMessageText(payload);
    onComplete(text ? [{ text }] : [], undefined, mapAnthropicUsage(payload.usage), undefined, undefined);
  } catch (error) {
    logService.error('Anthropic non-stream request failed:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

export const sendAnthropicMessageStream: StreamMessageSender = async (
  apiKey,
  modelId,
  history,
  parts,
  config,
  abortSignal,
  onPart,
  _onThoughtChunk,
  onError,
  onComplete,
  role = 'user',
) => {
  const anthropicConfig = asAnthropicChatConfig(config);
  let finalUsage: UsageMetadata | undefined;
  try {
    if (abortSignal.aborted) {
      onComplete(undefined, undefined, undefined);
      return;
    }
    const response = await fetch(
      buildAnthropicMessagesUrl(anthropicConfig.baseUrl),
      createRequestInit(
        apiKey,
        buildAnthropicRequestBody(modelId, history, parts, anthropicConfig, role, true),
        abortSignal,
      ),
    );
    if (!response.ok) {
      throw new Error(await readAnthropicErrorMessage(response));
    }
    await readAnthropicStreamEvents(response, abortSignal, (event: AnthropicStreamEvent) => {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        onPart({ text: event.delta.text });
      }
      if (event.usage) {
        const usage = mapAnthropicUsage(event.usage);
        if (usage) finalUsage = usage;
      }
      if (event.type === 'message_delta' && event.usage) {
        const usage = mapAnthropicUsage(event.usage);
        if (usage) finalUsage = usage;
      }
    });
    onComplete(finalUsage, undefined, undefined);
  } catch (error) {
    logService.error('Anthropic stream request failed:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};
