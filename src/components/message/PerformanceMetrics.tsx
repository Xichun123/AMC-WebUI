import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { type ChatMessage } from '@/types';
import { useI18n } from '@/contexts/I18nContext';

interface PerformanceMetricsProps {
  message: ChatMessage;
  hideTimer?: boolean;
}

const MIN_GENERATION_DURATION_SECONDS = 0.2;
const LIVE_TIMER_REFRESH_MS = 100;

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ message, hideTimer }) => {
  const { t } = useI18n();
  const {
    promptTokens,
    cachedPromptTokens,
    completionTokens,
    toolUsePromptTokens,
    thoughtTokens,
    generationStartTime,
    generationEndTime,
    firstTokenTimeMs,
    isLoading,
  } = message;
  const uncachedInputTokens = Math.max((promptTokens ?? 0) - (cachedPromptTokens ?? 0), 0);

  const [liveElapsedTime, setLiveElapsedTime] = useState<number>(() => {
    if (!generationStartTime) return 0;
    return (Date.now() - new Date(generationStartTime).getTime()) / 1000;
  });

  useEffect(() => {
    if (!generationStartTime || !isLoading) return;
    const startTime = new Date(generationStartTime).getTime();
    const updateTimer = () => setLiveElapsedTime((Date.now() - startTime) / 1000);
    const intervalId = setInterval(updateTimer, LIVE_TIMER_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, [generationStartTime, isLoading]);

  const elapsedTime = (() => {
    if (!generationStartTime) return 0;
    if (generationEndTime && !isLoading) {
      const startTime = new Date(generationStartTime).getTime();
      const endTime = new Date(generationEndTime).getTime();
      return (endTime - startTime) / 1000;
    }
    return liveElapsedTime;
  })();

  const generatedTokens = (completionTokens || 0) + (thoughtTokens || 0);

  let generationDuration = elapsedTime;
  if (firstTokenTimeMs !== undefined) {
    generationDuration = Math.max(0, elapsedTime - firstTokenTimeMs / 1000);
  }

  if (generationDuration < MIN_GENERATION_DURATION_SECONDS) {
    generationDuration = Math.max(MIN_GENERATION_DURATION_SECONDS, elapsedTime);
  }

  const tokensPerSecond = generatedTokens > 0 && generationDuration > 0 ? generatedTokens / generationDuration : 0;

  const showTokens =
    typeof promptTokens === 'number' ||
    typeof cachedPromptTokens === 'number' ||
    typeof completionTokens === 'number' ||
    typeof toolUsePromptTokens === 'number' ||
    typeof thoughtTokens === 'number';
  const showTimer = (isLoading && !hideTimer) || (generationStartTime && generationEndTime);

  if (!showTokens && !showTimer) return null;

  return (
    <div className="mt-2 flex justify-end items-center flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-[var(--theme-text-primary)] font-mono select-none">
      {showTokens && (
        <div
          className="flex items-center gap-1.5 bg-[var(--theme-bg-tertiary)]/30 px-2 py-0.5 rounded-md border border-[var(--theme-border-secondary)]/30"
          title={t('metrics_token_usage')}
        >
          <span className="flex items-center gap-2">
            <span>U: {uncachedInputTokens.toLocaleString()}</span>
            <span className="w-px h-3 bg-[var(--theme-text-primary)]/20"></span>
            {cachedPromptTokens !== undefined && cachedPromptTokens > 0 && (
              <>
                <span>C: {cachedPromptTokens.toLocaleString()}</span>
                <span className="w-px h-3 bg-[var(--theme-text-primary)]/20"></span>
              </>
            )}
            {toolUsePromptTokens !== undefined && toolUsePromptTokens > 0 && (
              <>
                <span>T: {toolUsePromptTokens.toLocaleString()}</span>
                <span className="w-px h-3 bg-[var(--theme-text-primary)]/20"></span>
              </>
            )}
            {thoughtTokens !== undefined && thoughtTokens > 0 && (
              <>
                <span className="flex items-center gap-1">R: {thoughtTokens.toLocaleString()}</span>
                <span className="w-px h-3 bg-[var(--theme-text-primary)]/20"></span>
              </>
            )}
            <span>O: {(completionTokens ?? 0).toLocaleString()}</span>
          </span>
        </div>
      )}

      {tokensPerSecond > 0 && (
        <div className="flex items-center gap-1" title={t('metrics_generation_speed')}>
          <Zap size={11} className="text-amber-400 fill-amber-400/20" strokeWidth={2} />
          <span>{tokensPerSecond.toFixed(1)} t/s</span>
        </div>
      )}

      {showTimer && (
        <div className="tabular-nums" title={t('metrics_total_duration')}>
          {elapsedTime.toFixed(1)}s
        </div>
      )}
    </div>
  );
};
