import { CHAT_INPUT_TEXTAREA_SELECTOR } from '@/constants/layout';

export const focusChatInput = (delayMs = 50) => {
  setTimeout(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.querySelector<HTMLTextAreaElement>(CHAT_INPUT_TEXTAREA_SELECTOR)?.focus();
  }, delayMs);
};
