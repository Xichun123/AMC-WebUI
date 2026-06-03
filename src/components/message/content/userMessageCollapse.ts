export type UserMessageCollapseKey = string;

export interface UserMessageCollapseController {
  expandedUserMessageKeys: ReadonlySet<UserMessageCollapseKey>;
  onToggleUserMessageExpanded: (key: UserMessageCollapseKey) => void;
}

export const USER_MESSAGE_COLLAPSE_LINE_THRESHOLD = 8;
export const USER_MESSAGE_COLLAPSED_LINE_HEIGHT = 1.65;

const USER_MESSAGE_COLLAPSE_CHARACTER_THRESHOLD = 600;

export const shouldCollapseUserMessageContent = (content: string): boolean => {
  if (content.length > USER_MESSAGE_COLLAPSE_CHARACTER_THRESHOLD) return true;
  return (content.match(/\n/g)?.length ?? 0) + 1 > USER_MESSAGE_COLLAPSE_LINE_THRESHOLD;
};

export const getUserMessageCollapseKey = (messageId: string, content: string): UserMessageCollapseKey => {
  const contentStart = content.slice(0, 64);
  const contentEnd = content.slice(-64);

  return `${messageId}:${content.length}:${contentStart}:${contentEnd}`;
};
