import type { ModelOption } from '@/types';

export interface EditableOpenAICompatibleModelRow {
  id: string;
  name: string;
  rowId: string;
}

export interface OpenAICompatibleModelEditorState {
  rows: EditableOpenAICompatibleModelRow[];
  sourceModelsKey: string;
}

export const createOpenAICompatibleModelRowId = () =>
  `openai-compatible-model-row-${Math.random().toString(36).slice(2, 10)}`;

export const buildOpenAICompatibleModelsKey = (models: Pick<ModelOption, 'id' | 'name'>[]): string =>
  models.map((model) => `${model.id}\u0001${model.name}`).join('\u0000');

export const getOpenAICompatibleModelName = (id: string, name: string) => name.trim() || id;

const createOpenAICompatibleModelOption = (id: string, name: string, isPinned = false): ModelOption => ({
  id,
  name: getOpenAICompatibleModelName(id, name),
  ...(isPinned ? { isPinned: true } : {}),
});

export const normalizeOpenAICompatibleModelRows = (
  rows: EditableOpenAICompatibleModelRow[],
): EditableOpenAICompatibleModelRow[] => {
  const seenModelIds = new Set<string>();

  return rows.reduce<EditableOpenAICompatibleModelRow[]>((normalizedRows, row) => {
    const modelId = row.id.trim();
    if (!modelId || seenModelIds.has(modelId)) {
      return normalizedRows;
    }

    seenModelIds.add(modelId);
    normalizedRows.push({
      ...row,
      id: modelId,
      name: row.name.trim(),
    });
    return normalizedRows;
  }, []);
};

export const buildOpenAICompatibleModelOptions = (rows: EditableOpenAICompatibleModelRow[]): ModelOption[] =>
  normalizeOpenAICompatibleModelRows(rows).map((row, index) =>
    createOpenAICompatibleModelOption(row.id, row.name, index === 0),
  );

export const collectOpenAICompatibleModels = (models: ModelOption[], selectedModelId: string): ModelOption[] => {
  const collectedModels = models.reduce<ModelOption[]>((result, model) => {
    const modelId = model.id.trim();
    if (!modelId) {
      return result;
    }

    result.push(createOpenAICompatibleModelOption(modelId, model.name, !!model.isPinned));
    return result;
  }, []);

  if (collectedModels.length > 0) {
    return collectedModels;
  }

  const fallbackModelId = selectedModelId.trim();
  return fallbackModelId ? [createOpenAICompatibleModelOption(fallbackModelId, fallbackModelId, true)] : [];
};

export const toEditableOpenAICompatibleModelRows = (models: ModelOption[]): EditableOpenAICompatibleModelRow[] =>
  models.map((model) => ({
    id: model.id,
    name: model.name,
    rowId: createOpenAICompatibleModelRowId(),
  }));

export const openaiCompatibleModelMatchesSearch = (
  model: Pick<ModelOption, 'id' | 'name'>,
  searchText: string,
): boolean => {
  const query = searchText.trim().toLowerCase();
  if (!query) return true;

  return model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query);
};

export const parsePastedOpenAICompatibleModelIds = (text: string): string[] => {
  const seenModelIds = new Set<string>();

  return text
    .split(/[\s,，;；]+/)
    .map((item) => item.trim())
    .filter((modelId) => {
      if (!modelId || seenModelIds.has(modelId)) {
        return false;
      }

      seenModelIds.add(modelId);
      return true;
    });
};

export const dedupeOpenAICompatibleModelOptions = (models: ModelOption[]): ModelOption[] => {
  const seenModelIds = new Set<string>();

  return models.reduce<ModelOption[]>((dedupedModels, model) => {
    const modelId = model.id.trim();
    if (!modelId || seenModelIds.has(modelId)) {
      return dedupedModels;
    }

    seenModelIds.add(modelId);
    dedupedModels.push(createOpenAICompatibleModelOption(modelId, model.name, !!model.isPinned));
    return dedupedModels;
  }, []);
};
