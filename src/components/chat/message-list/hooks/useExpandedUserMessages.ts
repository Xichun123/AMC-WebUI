import { useCallback, useMemo, useState } from 'react';
import type {
  UserMessageCollapseController,
  UserMessageCollapseKey,
} from '@/components/message/content/userMessageCollapse';

interface ExpandedUserMessagesState {
  activeSessionId: string | null;
  expandedUserMessageKeys: Set<UserMessageCollapseKey>;
}

export const useExpandedUserMessages = (activeSessionId: string | null): UserMessageCollapseController => {
  const [expandedUserMessagesState, setExpandedUserMessagesState] = useState<ExpandedUserMessagesState>(() => ({
    activeSessionId,
    expandedUserMessageKeys: new Set(),
  }));

  const expandedUserMessageKeys = useMemo(
    () =>
      expandedUserMessagesState.activeSessionId === activeSessionId
        ? expandedUserMessagesState.expandedUserMessageKeys
        : new Set<UserMessageCollapseKey>(),
    [activeSessionId, expandedUserMessagesState],
  );

  const onToggleUserMessageExpanded = useCallback(
    (key: UserMessageCollapseKey) => {
      setExpandedUserMessagesState((previousState) => {
        const currentKeys =
          previousState.activeSessionId === activeSessionId
            ? previousState.expandedUserMessageKeys
            : new Set<UserMessageCollapseKey>();
        const nextExpandedKeys = new Set(currentKeys);
        if (nextExpandedKeys.has(key)) {
          nextExpandedKeys.delete(key);
        } else {
          nextExpandedKeys.add(key);
        }
        return {
          activeSessionId,
          expandedUserMessageKeys: nextExpandedKeys,
        };
      });
    },
    [activeSessionId],
  );

  return useMemo(
    () => ({
      expandedUserMessageKeys,
      onToggleUserMessageExpanded,
    }),
    [expandedUserMessageKeys, onToggleUserMessageExpanded],
  );
};
