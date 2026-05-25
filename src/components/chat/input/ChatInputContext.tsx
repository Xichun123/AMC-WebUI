import { createContext, useContext, type Context } from 'react';
import type {
  ChatInputActionsContextValue,
  ChatInputComposerStatusContextValue,
  ChatInputContextValue,
  ChatInputToolbarContextValue,
} from './chatInputContextTypes';

export type {
  ChatInputActionsContextValue,
  ChatInputComposerStatusContextValue,
  ChatInputContextValue,
  ChatInputToolbarContextValue,
} from './chatInputContextTypes';

export const ChatInputContext = createContext<ChatInputContextValue | null>(null);
export const ChatInputToolbarContext = createContext<ChatInputToolbarContextValue | null>(null);
export const ChatInputActionsContext = createContext<ChatInputActionsContextValue | null>(null);
export const ChatInputComposerStatusContext = createContext<ChatInputComposerStatusContextValue | null>(null);

const useRequiredContext = <T,>(context: Context<T | null>, hookName: string, providerName: string) => {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used within ${providerName}`);
  }
  return value;
};

export const useChatInputContext = () => {
  return useRequiredContext(ChatInputContext, 'useChatInputContext', 'ChatInputProvider');
};

export const useChatInputToolbarContext = () => {
  return useRequiredContext(ChatInputToolbarContext, 'useChatInputToolbarContext', 'ChatInputProvider');
};

export const useChatInputActionsContext = () => {
  return useRequiredContext(ChatInputActionsContext, 'useChatInputActionsContext', 'ChatInputProvider');
};

export const useChatInputComposerStatusContext = () => {
  return useRequiredContext(ChatInputComposerStatusContext, 'useChatInputComposerStatusContext', 'ChatInputProvider');
};
