import React, { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { formatDuration } from '@/utils/durationFormat';

interface ThinkingTimerProps {
  startTime: Date;
}

const THINKING_TIMER_POLL_INTERVAL_MS = 100;

export const ThinkingTimer: React.FC<ThinkingTimerProps> = ({ startTime }) => {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - start) / 1000));
    }, THINKING_TIMER_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span>
      {t('thinking_text')} ({formatDuration(seconds)})
    </span>
  );
};
