import React, { createContext, useContext } from 'react';

import { useChatRuntimeValues } from './chatRuntimeValues';
import type {
  ChatHeaderRuntimeValue,
  ChatInputRuntimeValue,
  ChatMessageListRuntimeValue,
  ChatRuntimeProviderProps,
  ChatRuntimeValuesProviderProps,
} from './chatRuntimeTypes';

const ChatHeaderRuntimeContext = createContext<ChatHeaderRuntimeValue | null>(null);
const ChatMessageListRuntimeContext = createContext<ChatMessageListRuntimeValue | null>(null);
const ChatInputRuntimeContext = createContext<ChatInputRuntimeValue | null>(null);

const useRequiredContext = <T,>(context: React.Context<T | null>, name: string) => {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${name} must be used within ChatRuntimeProvider`);
  }
  return value;
};

const ChatRuntimeValuesProvider: React.FC<ChatRuntimeValuesProviderProps> = ({ value, children }) => (
  <ChatHeaderRuntimeContext.Provider value={value.header}>
    <ChatMessageListRuntimeContext.Provider value={value.messageList}>
      <ChatInputRuntimeContext.Provider value={value.input}>{children}</ChatInputRuntimeContext.Provider>
    </ChatMessageListRuntimeContext.Provider>
  </ChatHeaderRuntimeContext.Provider>
);

export const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({ app, children }) => {
  const value = useChatRuntimeValues(app);
  return <ChatRuntimeValuesProvider value={value}>{children}</ChatRuntimeValuesProvider>;
};

export const useChatHeaderRuntime = () => useRequiredContext(ChatHeaderRuntimeContext, 'useChatHeaderRuntime');
export const useChatMessageListRuntime = () =>
  useRequiredContext(ChatMessageListRuntimeContext, 'useChatMessageListRuntime');
export const useChatInputRuntime = () => useRequiredContext(ChatInputRuntimeContext, 'useChatInputRuntime');
