import { logService } from '@/services/logService';

type NotificationOptionsWithTag = NotificationOptions & {
  renotify?: boolean;
  tag?: string;
};

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export const showNotification = async (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window)) {
    logService.warn('This browser does not support desktop notification');
    return;
  }

  const show = () => {
    const notification = new Notification(title, {
      ...options,
      tag: 'amc-webui-response',
      renotify: true,
    } as NotificationOptionsWithTag);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => {
      notification.close();
    }, 7000);
  };

  if (Notification.permission === 'granted') {
    show();
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      show();
    }
  }
};

let sharedAudioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }
  return sharedAudioContext;
};

export const playCompletionSound = () => {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime + startTime);
      oscillator.stop(audioContext.currentTime + startTime + duration);
    };

    playNote(659.25, 0, 0.15);
    playNote(523.25, 0.15, 0.2);
  } catch (error) {
    logService.error('Error playing completion sound', error);
  }
};
