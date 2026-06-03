import React, { useMemo, useState } from 'react';
import { Loader2, Minus, Plus, RefreshCw, Settings2 } from 'lucide-react';
import type { ModelOption } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INLINE_ACTION_BUTTON_CLASS, SMALL_ICON_DANGER_BUTTON_CLASS } from '@/constants/buttonClasses';
import { OpenAICompatibleModelFetchResult } from './OpenAICompatibleModelFetchResult';
import { OpenAICompatibleModelManagerModal } from './OpenAICompatibleModelManagerModal';
import {
  buildOpenAICompatibleModelOptions,
  buildOpenAICompatibleModelsKey,
  collectOpenAICompatibleModels,
  createOpenAICompatibleModelRowId,
  type EditableOpenAICompatibleModelRow,
  type OpenAICompatibleModelEditorState,
  normalizeOpenAICompatibleModelRows,
  toEditableOpenAICompatibleModelRows,
} from './openaiCompatibleModelListState';

interface OpenAICompatibleModelListEditorProps {
  models: ModelOption[];
  selectedModelId: string;
  onModelsChange: (models: ModelOption[]) => void;
  onSelectedModelChange: (modelId: string) => void;
  onFetchModelsForImportPreview?: () => Promise<ModelOption[]>;
  isFetchModelsDisabled?: boolean;
  isFetchingModels?: boolean;
  fetchModelsStatus?: 'idle' | 'success' | 'error';
  fetchModelsMessage?: string | null;
}

export const OpenAICompatibleModelListEditor: React.FC<OpenAICompatibleModelListEditorProps> = ({
  models,
  selectedModelId,
  onModelsChange,
  onSelectedModelChange,
  onFetchModelsForImportPreview,
  isFetchModelsDisabled = false,
  isFetchingModels = false,
  fetchModelsStatus = 'idle',
  fetchModelsMessage = null,
}) => {
  const { t } = useI18n();
  const externalModels = useMemo(
    () => collectOpenAICompatibleModels(models, selectedModelId),
    [models, selectedModelId],
  );
  const externalModelsKey = buildOpenAICompatibleModelsKey(externalModels);
  const externalRows = useMemo(() => toEditableOpenAICompatibleModelRows(externalModels), [externalModels]);
  const [editorState, setEditorState] = useState<OpenAICompatibleModelEditorState>(() => ({
    rows: toEditableOpenAICompatibleModelRows(externalModels),
    sourceModelsKey: externalModelsKey,
  }));
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [fetchRequestId, setFetchRequestId] = useState(0);
  const rows = editorState.sourceModelsKey === externalModelsKey ? editorState.rows : externalRows;
  const currentModelIds = useMemo(() => new Set(normalizeOpenAICompatibleModelRows(rows).map((row) => row.id)), [rows]);

  const commitRows = (nextRows: EditableOpenAICompatibleModelRow[]) => {
    const modelOptions = buildOpenAICompatibleModelOptions(nextRows);
    const modelIds = modelOptions.map((model) => model.id);
    setEditorState({
      rows: nextRows,
      sourceModelsKey: externalModelsKey,
    });
    onModelsChange(modelOptions);

    if (modelIds.length > 0 && !modelIds.includes(selectedModelId)) {
      onSelectedModelChange(modelIds[0]);
    }
  };

  const handleAddModel = () => {
    setEditorState({
      rows: [...rows, { id: '', name: '', rowId: createOpenAICompatibleModelRowId() }],
      sourceModelsKey: externalModelsKey,
    });
  };

  const handleOpenFetchPreview = () => {
    setIsManagerOpen(true);
    setFetchRequestId((requestId) => requestId + 1);
  };

  const handleUpdateModel = (rowId: string, id: string) => {
    commitRows(rows.map((row) => (row.rowId === rowId ? { ...row, id } : row)));
  };

  const handleUpdateModelName = (rowId: string, name: string) => {
    commitRows(rows.map((row) => (row.rowId === rowId ? { ...row, name } : row)));
  };

  const handleTrimModel = (rowId: string) => {
    commitRows(rows.map((row) => (row.rowId === rowId ? { ...row, id: row.id.trim() } : row)));
  };

  const handleTrimModelName = (rowId: string) => {
    commitRows(rows.map((row) => (row.rowId === rowId ? { ...row, name: row.name.trim() } : row)));
  };

  const handleRemoveModel = (rowId: string) => {
    commitRows(rows.filter((row) => row.rowId !== rowId));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
          {t('settingsOpenAICompatibleModelId')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {onFetchModelsForImportPreview && (
            <button
              type="button"
              onClick={handleOpenFetchPreview}
              disabled={isFetchModelsDisabled || isFetchingModels}
              className={SETTINGS_INLINE_ACTION_BUTTON_CLASS}
              title={t('settingsFetchModelList')}
            >
              {isFetchingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isFetchingModels ? t('settingsFetchingModelList') : t('settingsFetchModelList')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            className={SETTINGS_INLINE_ACTION_BUTTON_CLASS}
            title={t('settingsOpenAICompatibleManageModels')}
          >
            <Settings2 size={14} />
            {t('settingsOpenAICompatibleManageModels')}
          </button>
          <button
            type="button"
            onClick={handleAddModel}
            className={SETTINGS_INLINE_ACTION_BUTTON_CLASS}
            title={t('settingsAddModel')}
          >
            <Plus size={14} />
            {t('settingsAddModel')}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-[var(--theme-bg-input)]/45 p-1.5">
        {rows.length > 0 ? (
          <div className="space-y-1">
            {rows.map((row, index) => (
              <div
                key={row.rowId}
                className="grid grid-cols-1 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--theme-bg-tertiary)]/35 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto]"
              >
                <div className="min-w-0 space-y-1">
                  <label
                    htmlFor={`${row.rowId}-id`}
                    className="block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-text-tertiary)]"
                  >
                    {t('settingsOpenAICompatibleModelIdShort')}
                  </label>
                  <input
                    id={`${row.rowId}-id`}
                    type="text"
                    value={row.id}
                    onChange={(event) => handleUpdateModel(row.rowId, event.target.value)}
                    onBlur={() => handleTrimModel(row.rowId)}
                    data-openai-compatible-model-id-input="true"
                    className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-mono text-[var(--theme-text-primary)] transition-colors placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:bg-[var(--theme-bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]/15"
                    placeholder="gpt-5.5"
                    aria-label={`${t('settingsOpenAICompatibleModelIdShort')} ${index + 1}`}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <label
                    htmlFor={`${row.rowId}-name`}
                    className="block text-[10px] font-medium uppercase tracking-wider text-[var(--theme-text-tertiary)]"
                  >
                    {t('settingsOpenAICompatibleModelName')}
                  </label>
                  <input
                    id={`${row.rowId}-name`}
                    type="text"
                    value={row.name}
                    onChange={(event) => handleUpdateModelName(row.rowId, event.target.value)}
                    onBlur={() => handleTrimModelName(row.rowId)}
                    data-openai-compatible-model-name-input="true"
                    className="w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-[var(--theme-text-primary)] transition-colors placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:bg-[var(--theme-bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]/15"
                    placeholder={t('settingsModelNamePlaceholder')}
                    aria-label={`${t('settingsOpenAICompatibleModelName')} ${index + 1}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveModel(row.rowId)}
                  className={`justify-self-end sm:self-end ${SMALL_ICON_DANGER_BUTTON_CLASS}`}
                  title={t('settingsRemoveModel')}
                  aria-label={t('settingsRemoveModel')}
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-center text-xs italic text-[var(--theme-text-tertiary)]">
            {t('settingsNoModelsInList')}
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-[var(--theme-text-tertiary)]">
        {t('settingsOpenAICompatibleModelIdHelp')}
      </p>

      <OpenAICompatibleModelFetchResult status={fetchModelsStatus} message={fetchModelsMessage} />

      <OpenAICompatibleModelManagerModal
        isOpen={isManagerOpen}
        rows={rows}
        currentModelIds={currentModelIds}
        fetchRequestId={fetchRequestId}
        onClose={() => setIsManagerOpen(false)}
        onCommitRows={commitRows}
        onFetchModelsForImportPreview={onFetchModelsForImportPreview}
        isFetchModelsDisabled={isFetchModelsDisabled}
        isFetchingModels={isFetchingModels}
        fetchModelsStatus={fetchModelsStatus}
        fetchModelsMessage={fetchModelsMessage}
      />
    </div>
  );
};
