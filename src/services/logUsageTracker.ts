import { dbService, type ApiUsageExactPricing } from '@/services/db/dbService';
import type { TokenUsageStats } from '@/types/logging';

export type ApiKeyListener = (usage: Map<string, number>) => void;
export type TokenUsageListener = (usage: Map<string, TokenUsageStats>) => void;

export interface TokenUsageInput {
  promptTokens: number;
  cachedPromptTokens?: number;
  completionTokens: number;
  thoughtTokens?: number;
  toolUsePromptTokens?: number;
  totalTokens?: number;
}

type UsageTrackerErrorReporter = (message: string, error: unknown) => void;

const API_USAGE_STORAGE_KEY = 'chatApiUsageData';
const TOKEN_USAGE_STORAGE_KEY = 'chatTokenUsageData';

class ApiKeyUsageTracker {
  private usage: Map<string, number> = new Map();
  private listeners: Set<ApiKeyListener> = new Set();

  constructor(private reportError: UsageTrackerErrorReporter) {
    this.load();
  }

  public record(apiKey: string) {
    if (!apiKey) return;

    const currentCount = this.usage.get(apiKey) || 0;
    this.usage.set(apiKey, currentCount + 1);
    this.save();
    this.notify();
  }

  public clear() {
    this.usage.clear();
    this.save();
    this.notify();
  }

  public subscribe(listener: ApiKeyListener): () => void {
    this.listeners.add(listener);
    listener(new Map(this.usage));
    return () => this.listeners.delete(listener);
  }

  private load() {
    try {
      const storedUsage = localStorage.getItem(API_USAGE_STORAGE_KEY);
      if (!storedUsage) return;

      const parsed = JSON.parse(storedUsage);
      if (Array.isArray(parsed)) {
        this.usage = new Map(parsed);
      }
    } catch (storageError) {
      this.reportError('Failed to load API key usage:', storageError);
    }
  }

  private save() {
    try {
      localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify(Array.from(this.usage.entries())));
    } catch (storageError) {
      this.reportError('Failed to save API key usage:', storageError);
    }
  }

  private notify() {
    const listenersToNotify = Array.from(this.listeners);
    for (const listener of listenersToNotify) {
      listener(new Map(this.usage));
    }
  }
}

class TokenUsageTracker {
  private usage: Map<string, TokenUsageStats> = new Map();
  private listeners: Set<TokenUsageListener> = new Set();

  constructor(private reportError: UsageTrackerErrorReporter) {
    this.load();
  }

  public record(modelId: string, usage: TokenUsageInput, exactPricing?: ApiUsageExactPricing) {
    if (!modelId) return;

    const current = this.usage.get(modelId) || { input: 0, output: 0 };
    const inputTokens =
      Math.max(usage.promptTokens - (usage.cachedPromptTokens ?? 0), 0) + (usage.toolUsePromptTokens ?? 0);
    const outputTokens = usage.completionTokens + (usage.thoughtTokens ?? 0);
    this.usage.set(modelId, {
      input: current.input + inputTokens,
      output: current.output + outputTokens,
    });
    this.save();
    this.notify();
    void dbService
      .addApiUsageRecord({
        timestamp: Date.now(),
        modelId,
        promptTokens: usage.promptTokens,
        cachedPromptTokens: usage.cachedPromptTokens ?? 0,
        completionTokens: usage.completionTokens,
        thoughtTokens: usage.thoughtTokens ?? 0,
        toolUsePromptTokens: usage.toolUsePromptTokens ?? 0,
        totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
        ...(exactPricing ? { exactPricing } : {}),
      })
      .catch((error) => this.reportError('Failed to persist API usage record:', error));
  }

  public clear() {
    this.usage.clear();
    this.save();
    this.notify();
  }

  public subscribe(listener: TokenUsageListener): () => void {
    this.listeners.add(listener);
    listener(new Map(this.usage));
    return () => this.listeners.delete(listener);
  }

  private normalize(stats: unknown): TokenUsageStats {
    if (!stats || typeof stats !== 'object') {
      return { input: 0, output: 0 };
    }

    const usage = stats as {
      input?: number;
      output?: number;
      prompt?: number;
      completion?: number;
    };

    return {
      input: usage.input ?? usage.prompt ?? 0,
      output: usage.output ?? usage.completion ?? 0,
    };
  }

  private load() {
    try {
      const storedUsage = localStorage.getItem(TOKEN_USAGE_STORAGE_KEY);
      if (!storedUsage) return;

      const parsed = JSON.parse(storedUsage);
      if (Array.isArray(parsed)) {
        this.usage = new Map(parsed.map(([modelId, stats]) => [modelId, this.normalize(stats)]));
      }
    } catch (storageError) {
      this.reportError('Failed to load token usage:', storageError);
    }
  }

  private save() {
    try {
      localStorage.setItem(TOKEN_USAGE_STORAGE_KEY, JSON.stringify(Array.from(this.usage.entries())));
    } catch (storageError) {
      this.reportError('Failed to save token usage:', storageError);
    }
  }

  private notify() {
    const listenersToNotify = Array.from(this.listeners);
    for (const listener of listenersToNotify) {
      listener(new Map(this.usage));
    }
  }
}

class LogUsageTracker {
  private apiKeys: ApiKeyUsageTracker;
  private tokens: TokenUsageTracker;

  constructor(reportError: UsageTrackerErrorReporter) {
    this.apiKeys = new ApiKeyUsageTracker(reportError);
    this.tokens = new TokenUsageTracker(reportError);
  }

  public recordApiKeyUsage(apiKey: string) {
    this.apiKeys.record(apiKey);
  }

  public recordTokenUsage(modelId: string, usage: TokenUsageInput, exactPricing?: ApiUsageExactPricing) {
    this.tokens.record(modelId, usage, exactPricing);
  }

  public subscribeToApiKeys(listener: ApiKeyListener): () => void {
    return this.apiKeys.subscribe(listener);
  }

  public subscribeToTokenUsage(listener: TokenUsageListener): () => void {
    return this.tokens.subscribe(listener);
  }

  public clear() {
    this.apiKeys.clear();
    this.tokens.clear();
  }
}

export const createLogUsageTracker = (reportError: UsageTrackerErrorReporter) => new LogUsageTracker(reportError);
