import React, { type RefObject } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Search, X } from 'lucide-react';
import { IconNewChat, IconNewGroup } from '@/components/icons';
import { DESKTOP_BREAKPOINT_PX } from '@/constants/layout';
import { SIDEBAR_ACTION_LINK_CLASS, SIDEBAR_ACTION_ROW_CLASS } from './sidebarStyles';

interface SidebarActionsProps {
  onNewChat: () => void;
  onCloseSidebar?: () => void;
  onAddNewGroup: () => void;
  isSearching: boolean;
  searchQuery: string;
  searchInputRef?: RefObject<HTMLInputElement>;
  setIsSearching: (isSearching: boolean) => void;
  setSearchQuery: (query: string) => void;
  newChatShortcut?: string;
  searchChatsShortcut?: string;
}

const COMPACT_SHORTCUT_PARTS: Record<string, string> = {
  Shift: '⇧',
  Cmd: '⌘',
  '⌘': '⌘',
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Opt: '⌥',
  Win: 'Win',
};

const COMPACT_SHORTCUT_ORDER: Record<string, number> = {
  Ctrl: 0,
  Alt: 1,
  Opt: 1,
  Shift: 2,
  Cmd: 3,
  '⌘': 3,
  Win: 3,
};

const compactShortcut = (shortcut: string): string => {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = parts
    .filter((part) => COMPACT_SHORTCUT_ORDER[part] !== undefined)
    .sort((a, b) => COMPACT_SHORTCUT_ORDER[a] - COMPACT_SHORTCUT_ORDER[b]);
  const keys = parts.filter((part) => COMPACT_SHORTCUT_ORDER[part] === undefined);

  return [...modifiers, ...keys].map((part) => COMPACT_SHORTCUT_PARTS[part] ?? part).join(' ');
};

const ShortcutHint = ({ shortcut }: { shortcut?: string }) => {
  if (!shortcut) {
    return null;
  }

  return (
    <kbd
      aria-hidden="true"
      data-testid="sidebar-action-shortcut"
      className="ml-auto shrink-0 whitespace-nowrap text-sm font-semibold leading-none tracking-normal text-[var(--theme-text-secondary)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {compactShortcut(shortcut)}
    </kbd>
  );
};

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  onNewChat,
  onCloseSidebar,
  onAddNewGroup,
  isSearching,
  searchQuery,
  searchInputRef,
  setIsSearching,
  setSearchQuery,
  newChatShortcut,
  searchChatsShortcut,
}) => {
  const { t } = useI18n();
  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery('');
  };

  const handleNewChatClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      onNewChat();
      if (window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        onCloseSidebar?.();
      }
    }
  };

  return (
    <div className="px-2 pt-2 space-y-1" data-testid="sidebar-actions-stack">
      <div>
        <a
          href="/"
          onClick={handleNewChatClick}
          className={SIDEBAR_ACTION_LINK_CLASS}
          aria-label={t('headerNewChat_aria')}
        >
          <IconNewChat size={18} className="text-[var(--theme-icon-history)]" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-[var(--theme-text-primary)]">{t('newChat')}</span>
          <ShortcutHint shortcut={newChatShortcut} />
        </a>
      </div>
      <div>
        {isSearching ? (
          <div className="group flex items-center gap-2 w-full text-left px-3 h-9 text-sm bg-[var(--theme-bg-primary)] border border-[var(--theme-border-secondary)] rounded-lg shadow-sm transition-all duration-200 focus-within:border-[var(--theme-border-focus)] focus-within:ring-1 focus-within:ring-[var(--theme-border-focus)]">
            <Search
              size={18}
              className="text-[var(--theme-icon-history)] flex-shrink-0 transition-colors group-focus-within:text-[var(--theme-text-primary)]"
              strokeWidth={2}
            />
            <input
              ref={searchInputRef}
              type="text"
              aria-label={t('history_search_aria')}
              placeholder={t('history_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 h-full py-0 text-sm focus:ring-0 outline-none text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-tertiary)]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch();
              }}
            />
            <button
              onClick={closeSearch}
              className="h-6 w-6 flex items-center justify-center text-[var(--theme-icon-history)] hover:text-[var(--theme-text-primary)] rounded-md hover:bg-[var(--theme-bg-tertiary)]"
              aria-label={t('history_search_clear_aria')}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsSearching(true)}
            className={SIDEBAR_ACTION_ROW_CLASS}
            aria-label={t('history_search_aria')}
          >
            <Search size={18} className="text-[var(--theme-icon-history)]" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate text-[var(--theme-text-primary)]">
              {t('history_search_button')}
            </span>
            <ShortcutHint shortcut={searchChatsShortcut} />
          </button>
        )}
      </div>
      <div>
        <button onClick={onAddNewGroup} className={SIDEBAR_ACTION_ROW_CLASS} aria-label={t('newGroup_aria')}>
          <IconNewGroup size={18} className="text-[var(--theme-icon-history)]" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate text-[var(--theme-text-primary)]">{t('newGroup_button')}</span>
        </button>
      </div>
    </div>
  );
};
