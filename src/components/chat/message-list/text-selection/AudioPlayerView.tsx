import React, { useState, type RefObject } from 'react';
import { GripVertical, X, Pause, Play } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { GoogleSpinner } from '@/components/icons/GoogleSpinner';

interface AudioPlayerViewProps {
  audioUrl: string | null;
  isLoading: boolean;
  audioRef: RefObject<HTMLAudioElement>;
  onDragStart: (e: React.MouseEvent) => void;
  onClose: (e: React.MouseEvent) => void;
}

export const AudioPlayerView: React.FC<AudioPlayerViewProps> = ({
  audioUrl,
  isLoading,
  audioRef,
  onDragStart,
  onClose,
}) => {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time) || !Number.isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent =
    duration > 0 && Number.isFinite(duration) ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  if (isLoading) {
    return (
      <div className="flex h-11 items-center gap-2.5 rounded-full border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)]/95 px-3 py-1.5 text-xs font-medium text-[var(--theme-text-primary)] shadow-[0_10px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <span data-audio-loading-spinner className="flex h-8 w-8 items-center justify-center">
          <GoogleSpinner size={20} />
        </span>
        <span className="pr-1 text-[var(--theme-text-secondary)]">{t('generating_audio')}</span>
      </div>
    );
  }

  if (!audioUrl) return null;

  return (
    <div
      aria-label="Text selection audio player"
      data-audio-player-surface
      className="flex h-11 w-[min(24rem,calc(100vw-1rem))] items-center gap-2 rounded-full border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)]/95 py-1.5 pl-1.5 pr-2 shadow-[0_12px_34px_rgba(0,0,0,0.18)] backdrop-blur-xl ring-1 ring-white/10 dark:ring-white/5"
    >
      <div
        onMouseDown={onDragStart}
        className="flex h-8 w-5 cursor-grab touch-none items-center justify-center rounded-full text-[var(--theme-text-tertiary)] transition-colors hover:bg-[var(--theme-bg-secondary)] hover:text-[var(--theme-text-secondary)] active:cursor-grabbing"
        title={t('drag_to_move')}
      >
        <GripVertical size={13} />
      </div>

      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay
        className="hidden"
        onLoadedMetadata={() => {
          const nextDuration = audioRef.current?.duration ?? 0;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <button
        type="button"
        onClick={togglePlayback}
        className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] shadow-sm transition-all hover:border-[var(--theme-border-focus)] hover:bg-[var(--theme-bg-tertiary)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--theme-bg-primary)]"
        aria-label={isPlaying ? t('audioPlayer_pause') : t('audioPlayer_play')}
      >
        {isPlaying ? (
          <Pause size={14} fill="currentColor" />
        ) : (
          <Play size={14} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div
        data-audio-progress-shell
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-[var(--theme-bg-secondary)]/60 px-2.5 py-1.5"
      >
        <div className="relative h-5 min-w-24 flex-1">
          <div
            data-audio-progress-track
            className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--theme-bg-tertiary)]"
          >
            <div
              data-audio-progress-fill
              className="h-full rounded-full bg-[var(--theme-text-link)] transition-[width] duration-100 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div
            data-audio-progress-thumb
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--theme-text-link)] opacity-95 transition-[left] duration-100 ease-linear"
            style={{ left: `${progressPercent}%` }}
          />
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!duration}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
            aria-label={t('audioPlayer_playback_progress')}
          />
        </div>

        <div
          data-audio-time-group
          className="flex w-12 flex-shrink-0 flex-col items-end gap-0.5 pl-1.5 font-mono text-[10px] leading-none tabular-nums"
        >
          <span data-audio-time-readout className="text-[var(--theme-text-primary)]">
            {formatTime(currentTime)}
          </span>
          <span data-audio-time-readout className="text-[var(--theme-text-tertiary)]">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="ml-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--theme-text-tertiary)] transition-colors hover:bg-[var(--theme-bg-secondary)] hover:text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]"
        aria-label={t('close')}
      >
        <X size={14} />
      </button>
    </div>
  );
};
