import type { UsageMetadata } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { calculateTokenStats } from './modelUsageStats';

type LegacyUsageMetadata = UsageMetadata & {
  candidatesTokenCount?: number;
};

const createUsageMetadata = (overrides: LegacyUsageMetadata): UsageMetadata => overrides;

describe('calculateTokenStats', () => {
  it('returns zeros for undefined metadata', () => {
    expect(calculateTokenStats(undefined)).toEqual({
      promptTokens: 0,
      cachedPromptTokens: 0,
      uncachedPromptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      thoughtTokens: 0,
      toolUsePromptTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });

  it('extracts token counts from metadata', () => {
    const result = calculateTokenStats(
      createUsageMetadata({
        totalTokenCount: 100,
        promptTokenCount: 30,
        candidatesTokenCount: 70,
      }),
    );
    expect(result).toEqual({
      promptTokens: 30,
      uncachedPromptTokens: 30,
      completionTokens: 70,
      totalTokens: 100,
      thoughtTokens: 0,
      cachedPromptTokens: 0,
      toolUsePromptTokens: 0,
      inputTokens: 30,
      outputTokens: 70,
    });
  });

  it('calculates completionTokens as total - prompt when candidatesTokenCount is missing', () => {
    const result = calculateTokenStats(
      createUsageMetadata({
        totalTokenCount: 100,
        promptTokenCount: 40,
      }),
    );
    expect(result.completionTokens).toBe(60);
  });

  it('extracts thought tokens', () => {
    const result = calculateTokenStats(
      createUsageMetadata({
        totalTokenCount: 200,
        promptTokenCount: 50,
        candidatesTokenCount: 150,
        thoughtsTokenCount: 40,
      }),
    );
    expect(result.thoughtTokens).toBe(40);
    expect(result.outputTokens).toBe(190);
  });

  it('extracts cached prompt tokens when usage metadata includes cache hits', () => {
    const result = calculateTokenStats(
      createUsageMetadata({
        totalTokenCount: 120,
        promptTokenCount: 80,
        candidatesTokenCount: 40,
        cachedContentTokenCount: 32,
      }),
    );

    expect(result.cachedPromptTokens).toBe(32);
    expect(result.uncachedPromptTokens).toBe(48);
    expect(result.inputTokens).toBe(48);
    expect(result.totalTokens).toBe(120);
  });

  it('supports responseTokenCount and tool-use prompt buckets from newer SDK responses', () => {
    const result = calculateTokenStats(
      createUsageMetadata({
        promptTokenCount: 27,
        responseTokenCount: 45,
        thoughtsTokenCount: 31,
        toolUsePromptTokenCount: 10309,
        totalTokenCount: 10412,
      }),
    );

    expect(result).toEqual({
      promptTokens: 27,
      cachedPromptTokens: 0,
      uncachedPromptTokens: 27,
      completionTokens: 45,
      thoughtTokens: 31,
      toolUsePromptTokens: 10309,
      inputTokens: 10336,
      outputTokens: 76,
      totalTokens: 10412,
    });
  });

  it('does not infer completion from total when thought or tool-use buckets are present but response tokens are missing', () => {
    const result = calculateTokenStats(
      createUsageMetadata({
        promptTokenCount: 20,
        thoughtsTokenCount: 5,
        toolUsePromptTokenCount: 11,
        totalTokenCount: 100,
      }),
    );

    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(36);
  });
});
