import type { UsageMetadata } from '@google/genai';

export const calculateTokenStats = (usageMetadata?: UsageMetadata) => {
  if (!usageMetadata) {
    return {
      promptTokens: 0,
      cachedPromptTokens: 0,
      uncachedPromptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      thoughtTokens: 0,
      toolUsePromptTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const promptTokens = usageMetadata.promptTokenCount || 0;
  const usageWithCachedCount = usageMetadata as UsageMetadata & { cachedContentTokenCount?: number };
  const cachedPromptTokens = usageWithCachedCount.cachedContentTokenCount || 0;
  const uncachedPromptTokens = Math.max(promptTokens - cachedPromptTokens, 0);
  const usageWithThoughtCount = usageMetadata as UsageMetadata & { thoughtsTokenCount?: number };
  const thoughtTokens = usageWithThoughtCount.thoughtsTokenCount || 0;
  const usageWithToolUseCount = usageMetadata as UsageMetadata & { toolUsePromptTokenCount?: number };
  const toolUsePromptTokens = usageWithToolUseCount.toolUsePromptTokenCount || 0;
  const usageWithResponseCount = usageMetadata as UsageMetadata & {
    candidatesTokenCount?: number;
    responseTokenCount?: number;
  };
  let completionTokens = usageWithResponseCount.responseTokenCount || usageWithResponseCount.candidatesTokenCount || 0;

  if (!completionTokens && !thoughtTokens && !toolUsePromptTokens) {
    const totalTokenCount = usageMetadata.totalTokenCount || 0;
    if (totalTokenCount > 0 && promptTokens > 0) {
      completionTokens = Math.max(totalTokenCount - promptTokens, 0);
    }
  }

  const inputTokens = uncachedPromptTokens + toolUsePromptTokens;
  const outputTokens = completionTokens + thoughtTokens;
  const totalTokens = inputTokens + cachedPromptTokens + outputTokens || usageMetadata.totalTokenCount || 0;

  return {
    promptTokens,
    cachedPromptTokens,
    uncachedPromptTokens,
    completionTokens,
    totalTokens,
    thoughtTokens,
    toolUsePromptTokens,
    inputTokens,
    outputTokens,
  };
};
