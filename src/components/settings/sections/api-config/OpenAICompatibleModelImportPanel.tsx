import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Loader2, Plus, RefreshCw } from 'lucide-react';
import type { ModelOption } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import {
  SETTINGS_PRIMARY_ACTION_BUTTON_CLASS,
  SETTINGS_SECONDARY_ACTION_BUTTON_CLASS,
} from '@/constants/buttonClasses';
import { OpenAICompatibleModelFetchResult } from './OpenAICompatibleModelFetchResult';
import {
  createOpenAICompatibleModelRowId,
  dedupeOpenAICompatibleModelOptions,
  type EditableOpenAICompatibleModelRow,
  parsePastedOpenAICompatibleModelIds,
} from './openaiCompatibleModelListState';

interface OpenAICompatibleModelImportPanelProps {
  rows: EditableOpenAICompatibleModelRow[];
  currentModelIds: ReadonlySet<string>;
  fetchRequestId: number;
  onCommitRows: (rows: EditableOpenAICompatibleModelRow[]) => void;
  onFetchModelsForImportPreview?: () => Promise<ModelOption[]>;
  isOpen: boolean;
  isFetchModelsDisabled?: boolean;
  isFetchingModels?: boolean;
  fetchModelsStatus?: 'idle' | 'success' | 'error';
  fetchModelsMessage?: string | null;
}

export const OpenAICompatibleModelImportPanel: React.FC<OpenAICompatibleModelImportPanelProps> = ({
  rows,
  currentModelIds,
  fetchRequestId,
  onCommitRows,
  onFetchModelsForImportPreview,
  isOpen,
  isFetchModelsDisabled = false,
  isFetchingModels = false,
  fetchModelsStatus = 'idle',
  fetchModelsMessage = null,
}) => {
  const { t } = useI18n();
  const [batchModelText, setBatchModelText] = useState('');
  const [fetchedPreviewModels, setFetchedPreviewModels] = useState<ModelOption[]>([]);
  const [selectedFetchedModelIds, setSelectedFetchedModelIds] = useState<Set<string>>(() => new Set());
  const [managerMessage, setManagerMessage] = useState<string | null>(null);
  const handledFetchRequestIdRef = useRef(0);

  const importableFetchedModelIds = useMemo(
    () => fetchedPreviewModels.filter((model) => !currentModelIds.has(model.id)).map((model) => model.id),
    [currentModelIds, fetchedPreviewModels],
  );
  const selectedImportableFetchedModelIds = useMemo(
    () => importableFetchedModelIds.filter((modelId) => selectedFetchedModelIds.has(modelId)),
    [importableFetchedModelIds, selectedFetchedModelIds],
  );

  const handleFetchModelsForPreview = useCallback(async () => {
    if (!onFetchModelsForImportPreview) return;

    setManagerMessage(null);
    const fetchedModels = await onFetchModelsForImportPreview();
    const dedupedFetchedModels = dedupeOpenAICompatibleModelOptions(fetchedModels);
    setFetchedPreviewModels(dedupedFetchedModels);
    setSelectedFetchedModelIds(
      new Set(dedupedFetchedModels.filter((model) => !currentModelIds.has(model.id)).map((model) => model.id)),
    );
  }, [currentModelIds, onFetchModelsForImportPreview]);

  useEffect(() => {
    if (!isOpen || fetchRequestId === 0 || handledFetchRequestIdRef.current === fetchRequestId) {
      return;
    }

    handledFetchRequestIdRef.current = fetchRequestId;
    const fetchTimerId = window.setTimeout(() => {
      void handleFetchModelsForPreview();
    }, 0);

    return () => window.clearTimeout(fetchTimerId);
  }, [fetchRequestId, handleFetchModelsForPreview, isOpen]);

  const handleAddPastedModels = () => {
    const pastedModelIds = parsePastedOpenAICompatibleModelIds(batchModelText);
    const rowsToAdd = pastedModelIds
      .filter((modelId) => !currentModelIds.has(modelId))
      .map((modelId) => ({ id: modelId, name: modelId, rowId: createOpenAICompatibleModelRowId() }));

    if (rowsToAdd.length === 0) {
      setManagerMessage(t('settingsOpenAICompatibleModelPasteNoNewModels'));
      return;
    }

    onCommitRows([...rows, ...rowsToAdd]);
    setBatchModelText('');
    setManagerMessage(t('settingsOpenAICompatibleModelPasteAdded').replace('{count}', String(rowsToAdd.length)));
  };

  const handleToggleFetchedModel = (modelId: string, checked: boolean) => {
    setSelectedFetchedModelIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(modelId);
      } else {
        next.delete(modelId);
      }
      return next;
    });
  };

  const handleSelectAllFetchedModels = () => {
    setSelectedFetchedModelIds(new Set(importableFetchedModelIds));
  };

  const handleClearFetchedSelection = () => {
    setSelectedFetchedModelIds(new Set());
  };

  const handleImportFetchedModels = () => {
    const rowsToAdd = fetchedPreviewModels
      .filter((model) => selectedFetchedModelIds.has(model.id) && !currentModelIds.has(model.id))
      .map((model) => ({
        id: model.id,
        name: model.name,
        rowId: createOpenAICompatibleModelRowId(),
      }));

    if (rowsToAdd.length === 0) {
      setManagerMessage(t('settingsOpenAICompatibleModelImportNoSelection'));
      return;
    }

    onCommitRows([...rows, ...rowsToAdd]);
    setSelectedFetchedModelIds(new Set());
    setManagerMessage(t('settingsOpenAICompatibleModelImportAdded').replace('{count}', String(rowsToAdd.length)));
  };

  return (
    <section className="min-w-0 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
          <ClipboardList size={14} />
          {t('settingsOpenAICompatibleBatchPasteTitle')}
        </div>
        <textarea
          value={batchModelText}
          onChange={(event) => setBatchModelText(event.target.value)}
          data-openai-compatible-batch-model-input="true"
          className="min-h-28 w-full resize-y rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)] p-3 font-mono text-sm text-[var(--theme-text-primary)] outline-none transition-colors placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:ring-2 focus:ring-[var(--theme-border-focus)]/15"
          placeholder={t('settingsOpenAICompatibleBatchPastePlaceholder')}
        />
        <div className="flex justify-end">
          <button type="button" onClick={handleAddPastedModels} className={SETTINGS_SECONDARY_ACTION_BUTTON_CLASS}>
            <Plus size={14} />
            {t('settingsOpenAICompatibleAddPastedModels')}
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--theme-border-secondary)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]">
            {t('settingsOpenAICompatibleFetchedPreviewTitle')}
          </div>
          {onFetchModelsForImportPreview && (
            <button
              type="button"
              onClick={() => void handleFetchModelsForPreview()}
              disabled={isFetchModelsDisabled || isFetchingModels}
              className={SETTINGS_SECONDARY_ACTION_BUTTON_CLASS}
            >
              {isFetchingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isFetchingModels ? t('settingsFetchingModelList') : t('settingsFetchModelList')}
            </button>
          )}
        </div>

        <OpenAICompatibleModelFetchResult status={fetchModelsStatus} message={fetchModelsMessage} />

        {fetchedPreviewModels.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[var(--theme-text-tertiary)]">
                {t('settingsOpenAICompatibleFetchedPreviewCount')
                  .replace('{count}', String(fetchedPreviewModels.length))
                  .replace('{selected}', String(selectedImportableFetchedModelIds.length))}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFetchedModels}
                  disabled={importableFetchedModelIds.length === 0}
                  className="text-xs font-medium text-[var(--theme-text-link)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('settingsOpenAICompatibleSelectAllFetched')}
                </button>
                <button
                  type="button"
                  onClick={handleClearFetchedSelection}
                  disabled={selectedFetchedModelIds.size === 0}
                  className="text-xs font-medium text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('settingsOpenAICompatibleClearFetchedSelection')}
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md bg-[var(--theme-bg-input)]/45 p-1 custom-scrollbar">
              {fetchedPreviewModels.map((model) => {
                const alreadyAdded = currentModelIds.has(model.id);
                const checked = !alreadyAdded && selectedFetchedModelIds.has(model.id);

                return (
                  <label
                    key={model.id}
                    className={`flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                      alreadyAdded ? 'opacity-60' : 'hover:bg-[var(--theme-bg-tertiary)]/35'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={alreadyAdded}
                      onChange={(event) => handleToggleFetchedModel(model.id, event.target.checked)}
                      className="mt-0.5"
                      data-openai-compatible-fetched-model-checkbox="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[var(--theme-text-primary)]">{model.id}</span>
                      {alreadyAdded && (
                        <span className="mt-0.5 block text-xs text-[var(--theme-text-tertiary)]">
                          {t('settingsOpenAICompatibleAlreadyAdded')}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleImportFetchedModels}
                disabled={selectedImportableFetchedModelIds.length === 0}
                className={SETTINGS_PRIMARY_ACTION_BUTTON_CLASS}
              >
                {t('settingsOpenAICompatibleImportSelectedModels')}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-md bg-[var(--theme-bg-input)]/45 px-3 py-6 text-center text-xs italic text-[var(--theme-text-tertiary)]">
            {t('settingsOpenAICompatibleFetchedPreviewEmpty')}
          </div>
        )}
      </div>

      {managerMessage && (
        <div className="rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)]/45 px-3 py-2 text-xs text-[var(--theme-text-secondary)]">
          {managerMessage}
        </div>
      )}
    </section>
  );
};
