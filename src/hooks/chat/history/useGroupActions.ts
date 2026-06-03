import { useCallback } from 'react';
import { type ChatGroup, type SavedChatSession } from '@/types';
import { logService } from '@/services/logService';

interface UseGroupActionsProps {
  updateAndPersistGroups: (updater: (prev: ChatGroup[]) => ChatGroup[]) => void | Promise<void>;
  updateAndPersistSessions: (
    updater: (prev: SavedChatSession[]) => SavedChatSession[],
    options?: { persist?: boolean },
  ) => void | Promise<void>;
  t: (key: string) => string;
}

export const useGroupActions = ({ updateAndPersistGroups, updateAndPersistSessions, t }: UseGroupActionsProps) => {
  const handleAddNewGroup = useCallback(() => {
    logService.info('Adding new group.');
    const newGroup: ChatGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: t('newGroup_title'),
      timestamp: Date.now(),
      isExpanded: true,
    };
    updateAndPersistGroups((prev) => [newGroup, ...prev]);
  }, [updateAndPersistGroups, t]);

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      logService.info(`Deleting group: ${groupId}`);
      updateAndPersistGroups((prev) => prev.filter((group) => group.id !== groupId));
      updateAndPersistSessions((prev) =>
        prev.map((session) => (session.groupId === groupId ? { ...session, groupId: null } : session)),
      );
    },
    [updateAndPersistGroups, updateAndPersistSessions],
  );

  const handleRenameGroup = useCallback(
    (groupId: string, newTitle: string) => {
      if (!newTitle.trim()) return;
      logService.info(`Renaming group ${groupId} to "${newTitle}"`);
      updateAndPersistGroups((prev) =>
        prev.map((group) => (group.id === groupId ? { ...group, title: newTitle.trim() } : group)),
      );
    },
    [updateAndPersistGroups],
  );

  const handleMoveSessionToGroup = useCallback(
    (sessionId: string, groupId: string | null) => {
      logService.info(`Moving session ${sessionId} to group ${groupId}`);
      updateAndPersistSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? { ...session, groupId } : session)),
      );
    },
    [updateAndPersistSessions],
  );

  const handleToggleGroupExpansion = useCallback(
    (groupId: string) => {
      updateAndPersistGroups((prev) =>
        prev.map((group) => (group.id === groupId ? { ...group, isExpanded: !(group.isExpanded ?? true) } : group)),
      );
    },
    [updateAndPersistGroups],
  );

  return {
    handleAddNewGroup,
    handleDeleteGroup,
    handleRenameGroup,
    handleMoveSessionToGroup,
    handleToggleGroupExpansion,
  };
};
