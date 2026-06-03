import { useEffect } from 'react';
import { useChatInputHeight } from '@/hooks/chat-input/useChatInputHeight';
import { useUIStore } from '@/stores/uiStore';

export const useChatArea = () => {
  const { chatInputHeight, chatInputContainerRef } = useChatInputHeight();
  const setChatInputHeight = useUIStore((state) => state.setChatInputHeight);

  useEffect(() => {
    setChatInputHeight(chatInputHeight);
  }, [chatInputHeight, setChatInputHeight]);

  return {
    chatInputContainerRef,
  };
};
