import React, { useMemo, useState } from 'react';
import { Minus, Search } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { SMALL_ICON_DANGER_BUTTON_CLASS } from '@/constants/buttonClasses';
import {
  type EditableOpenAICompatibleModelRow,
  getOpenAICompatibleModelName,
  openaiCompatibleModelMatchesSearch,
} from './openaiCompatibleModelListState';

interface OpenAICompatibleCurrentModelsPanelProps {
  rows: EditableOpenAICompatibleModelRow[];
  onCommitRows: (rows: EditableOpenAICompatibleModelRow[]) => void;
}

export const OpenAICompatibleCurrentModelsPanel: React.FC<OpenAICompatibleCurrentModelsPanelProps> = ({
  rows,
  onCommitRows,
}) => {
  const { t } = useI18n();
  const [modelSearchText, setModelSearchText] = useState('');
  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        openaiCompatibleModelMatchesSearch(
          { id: row.id, name: getOpenAICompatibleModelName(row.id, row.name) },
          modelSearchText,
        ),
      ),
    [modelSearchText, rows],
  );

  const handleUpdateModel = (rowId: string, id: string) => {
    onCommitRows(rows.map((row) => (row.rowId === rowId ? { ...row, id } : row)));
  };

  const handleUpdateModelName = (rowId: string, name: string) => {
    onCommitRows(rows.map((row) => (row.rowId === rowId ? { ...row, name } : row)));
  };

  const handleTrimModel = (rowId: string) => {
    onCommitRows(rows.map((row) => (row.rowId === rowId ? { ...row, id: row.id.trim() } : row)));
  };

  const handleTrimModelName = (rowId: string) => {
    onCommitRows(rows.map((row) => (row.rowId === rowId ? { ...row, name: row.name.trim() } : row)));
  };

  const handleRemoveModel = (rowId: string) => {
    onCommitRows(rows.filter((row) => row.rowId !== rowId));
  };

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
          {t('settingsOpenAICompatibleCurrentModels')}
        </div>
        <span className="rounded-full bg-[var(--theme-bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--theme-text-tertiary)]">
          {rows.length}
        </span>
      </div>
      <label className="relative block">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-tertiary)]"
        />
        <input
          type="search"
          value={modelSearchText}
          onChange={(event) => setModelSearchText(event.target.value)}
          className="w-full rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)] py-2 pl-9 pr-3 text-sm text-[var(--theme-text-primary)] outline-none transition-colors placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:ring-2 focus:ring-[var(--theme-border-focus)]/15"
          placeholder={t('settingsOpenAICompatibleModelSearch')}
          aria-label={t('settingsOpenAICompatibleModelSearch')}
          data-openai-compatible-model-search-input="true"
        />
      </label>

      <div className="max-h-[430px] overflow-y-auto rounded-lg bg-[var(--theme-bg-input)]/45 p-1.5 custom-scrollbar">
        {filteredRows.length > 0 ? (
          <div className="space-y-1">
            {filteredRows.map((row) => (
              <div
                key={row.rowId}
                className="grid grid-cols-1 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--theme-bg-tertiary)]/35 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto]"
              >
                <input
                  type="text"
                  value={row.id}
                  onChange={(event) => handleUpdateModel(row.rowId, event.target.value)}
                  onBlur={() => handleTrimModel(row.rowId)}
                  data-openai-compatible-manager-model-id-input="true"
                  className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 font-mono text-sm text-[var(--theme-text-primary)] transition-colors placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:bg-[var(--theme-bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]/15"
                  placeholder="gpt-5.5"
                  aria-label={t('settingsOpenAICompatibleModelIdShort')}
                />
                <input
                  type="text"
                  value={row.name}
                  onChange={(event) => handleUpdateModelName(row.rowId, event.target.value)}
                  onBlur={() => handleTrimModelName(row.rowId)}
                  data-openai-compatible-manager-model-name-input="true"
                  className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--theme-text-primary)] transition-colors placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:bg-[var(--theme-bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]/15"
                  placeholder={t('settingsModelNamePlaceholder')}
                  aria-label={t('settingsOpenAICompatibleModelName')}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveModel(row.rowId)}
                  className={`justify-self-end ${SMALL_ICON_DANGER_BUTTON_CLASS}`}
                  title={t('settingsRemoveModel')}
                  aria-label={t('settingsRemoveModel')}
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-8 text-center text-xs italic text-[var(--theme-text-tertiary)]">
            {t('modelPickerNoResults')}
          </div>
        )}
      </div>
    </section>
  );
};
