import { APP_NOTIFICATION_ICON_URL } from '@/constants/assets';
import type { AppSettings, ChatMessage } from '@/types';
import { playCompletionSound, showNotification } from '@/utils/completionFeedback';

const DEFAULT_NOTIFICATION_BODY = 'Media or tool response received';
const MAX_NOTIFICATION_BODY_LENGTH = 150;

export interface CompletionNotification {
  title: string;
  body: string;
}

export interface CompletionFeedback {
  sound?: boolean;
  notification?: CompletionNotification;
}

type CompletionFeedbackSettings = Pick<AppSettings, 'isCompletionNotificationEnabled' | 'isCompletionSoundEnabled'>;

export const buildCompletionNotificationBody = (
  message: Pick<ChatMessage, 'content'>,
  fallback = DEFAULT_NOTIFICATION_BODY,
): string => {
  const content = message.content || fallback;
  return content.length > MAX_NOTIFICATION_BODY_LENGTH
    ? `${content.substring(0, MAX_NOTIFICATION_BODY_LENGTH)}...`
    : content;
};

export const emitCompletionFeedback = async (
  settings: CompletionFeedbackSettings,
  feedback: CompletionFeedback = {},
) => {
  if (feedback.sound !== false && settings.isCompletionSoundEnabled) {
    playCompletionSound();
  }

  if (
    !feedback.notification ||
    !settings.isCompletionNotificationEnabled ||
    typeof document === 'undefined' ||
    !document.hidden
  ) {
    return;
  }

  await showNotification(feedback.notification.title, {
    body: feedback.notification.body,
    icon: APP_NOTIFICATION_ICON_URL,
  });
};
