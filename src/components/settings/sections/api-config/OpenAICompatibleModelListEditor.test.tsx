import { act } from 'react';
import { setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupStoreStateReset } from '@/test/stores/reset';
import { OpenAICompatibleModelListEditor } from './OpenAICompatibleModelListEditor';

const setInputValue = (input: HTMLInputElement | HTMLTextAreaElement | null | undefined, value: string) => {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  input?.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('OpenAICompatibleModelListEditor', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });
  setupStoreStateReset();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a blank row and saves typed model IDs as model options', () => {
    const onModelsChange = vi.fn();

    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }]}
          selectedModelId="gpt-5.5"
          onModelsChange={onModelsChange}
          onSelectedModelChange={vi.fn()}
        />,
      );
    });

    act(() => {
      const addButton = Array.from(renderer.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Add Model'),
      );
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const inputs = Array.from(
      renderer.container.querySelectorAll<HTMLInputElement>('input[data-openai-compatible-model-id-input="true"]'),
    );

    expect(inputs.map((input) => input.value)).toEqual(['gpt-5.5', '']);

    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(inputs[1], 'deepseek-chat');
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenCalledWith([
      { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
      { id: 'deepseek-chat', name: 'deepseek-chat' },
    ]);
  });

  it('saves custom model names for the model picker display', () => {
    const onModelsChange = vi.fn();

    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[{ id: 'openrouter/deepseek-chat', name: 'openrouter/deepseek-chat', isPinned: true }]}
          selectedModelId="openrouter/deepseek-chat"
          onModelsChange={onModelsChange}
          onSelectedModelChange={vi.fn()}
        />,
      );
    });

    const nameInput = renderer.container.querySelector<HTMLInputElement>(
      'input[data-openai-compatible-model-name-input="true"]',
    );

    expect(nameInput?.value).toBe('openrouter/deepseek-chat');

    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(nameInput, 'DeepSeek Chat');
      nameInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenLastCalledWith([
      { id: 'openrouter/deepseek-chat', name: 'DeepSeek Chat', isPinned: true },
    ]);
  });

  it('falls back to the model ID when the model name is blank', () => {
    const onModelsChange = vi.fn();

    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[{ id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', isPinned: true }]}
          selectedModelId="gpt-4.1-mini"
          onModelsChange={onModelsChange}
          onSelectedModelChange={vi.fn()}
        />,
      );
    });

    const nameInput = renderer.container.querySelector<HTMLInputElement>(
      'input[data-openai-compatible-model-name-input="true"]',
    );

    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(nameInput, '   ');
      nameInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenLastCalledWith([{ id: 'gpt-4.1-mini', name: 'gpt-4.1-mini', isPinned: true }]);
  });

  it('deduplicates model IDs when rows are edited to the same ID', () => {
    const onModelsChange = vi.fn();

    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[
            { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
            { id: 'gpt-4.1', name: 'GPT-4.1' },
          ]}
          selectedModelId="gpt-5.5"
          onModelsChange={onModelsChange}
          onSelectedModelChange={vi.fn()}
        />,
      );
    });

    const inputs = Array.from(
      renderer.container.querySelectorAll<HTMLInputElement>('input[data-openai-compatible-model-id-input="true"]'),
    );

    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(inputs[1], 'gpt-5.5');
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenLastCalledWith([{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }]);
  });

  it('selects the first remaining model when the active model is removed', () => {
    const onModelsChange = vi.fn();
    const onSelectedModelChange = vi.fn();

    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[
            { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
            { id: 'gpt-4.1', name: 'GPT-4.1' },
          ]}
          selectedModelId="gpt-5.5"
          onModelsChange={onModelsChange}
          onSelectedModelChange={onSelectedModelChange}
        />,
      );
    });

    const removeButtons = Array.from(renderer.container.querySelectorAll('button')).filter((button) =>
      button.getAttribute('title')?.includes('Remove Model'),
    );

    act(() => {
      removeButtons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenLastCalledWith([{ id: 'gpt-4.1', name: 'GPT-4.1', isPinned: true }]);
    expect(onSelectedModelChange).toHaveBeenCalledWith('gpt-4.1');
  });

  it('filters current models in the manager modal', () => {
    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[
            { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
            { id: 'deepseek-chat', name: 'DeepSeek Chat' },
            { id: 'qwen-plus', name: 'Qwen Plus' },
          ]}
          selectedModelId="gpt-5.5"
          onModelsChange={vi.fn()}
          onSelectedModelChange={vi.fn()}
        />,
      );
    });

    act(() => {
      Array.from(renderer.container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Manage Models'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const searchInput = document.body.querySelector<HTMLInputElement>(
      'input[data-openai-compatible-model-search-input="true"]',
    );

    act(() => {
      setInputValue(searchInput, 'deepseek');
    });

    const visibleModelInputs = Array.from(
      document.body.querySelectorAll<HTMLInputElement>('input[data-openai-compatible-manager-model-id-input="true"]'),
    );

    expect(visibleModelInputs.map((input) => input.value)).toEqual(['deepseek-chat']);
  });

  it('adds pasted model IDs and skips duplicates', () => {
    const onModelsChange = vi.fn();

    act(() => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }]}
          selectedModelId="gpt-5.5"
          onModelsChange={onModelsChange}
          onSelectedModelChange={vi.fn()}
        />,
      );
    });

    act(() => {
      Array.from(renderer.container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Manage Models'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const batchTextarea = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[data-openai-compatible-batch-model-input="true"]',
    );

    act(() => {
      setInputValue(batchTextarea, 'gpt-5.5\ndeepseek-chat, qwen-plus; deepseek-chat');
    });

    act(() => {
      Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Add Pasted Models'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenLastCalledWith([
      { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
      { id: 'deepseek-chat', name: 'deepseek-chat' },
      { id: 'qwen-plus', name: 'qwen-plus' },
    ]);
    expect(document.body.textContent).toContain('Added 2 models.');
  });

  it('previews fetched models before importing the selected new IDs', async () => {
    const onModelsChange = vi.fn();
    const onFetchModels = vi.fn().mockResolvedValue([
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'deepseek-chat', name: 'deepseek-chat' },
      { id: 'qwen-plus', name: 'qwen-plus' },
    ]);

    await act(async () => {
      renderer.root.render(
        <OpenAICompatibleModelListEditor
          models={[{ id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true }]}
          selectedModelId="gpt-5.5"
          onModelsChange={onModelsChange}
          onSelectedModelChange={vi.fn()}
          onFetchModelsForImportPreview={onFetchModels}
        />,
      );
    });

    await act(async () => {
      Array.from(renderer.container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Fetch Models'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('deepseek-chat');
      expect(document.body.textContent).toContain('qwen-plus');
    });

    const fetchedCheckboxes = Array.from(
      document.body.querySelectorAll<HTMLInputElement>('input[data-openai-compatible-fetched-model-checkbox="true"]'),
    );
    expect(fetchedCheckboxes.map((checkbox) => checkbox.disabled)).toEqual([true, false, false]);
    expect(fetchedCheckboxes.map((checkbox) => checkbox.checked)).toEqual([false, true, true]);

    await act(async () => {
      fetchedCheckboxes[2].click();
    });

    await act(async () => {
      Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Import Selected'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onModelsChange).toHaveBeenLastCalledWith([
      { id: 'gpt-5.5', name: 'GPT-5.5', isPinned: true },
      { id: 'deepseek-chat', name: 'deepseek-chat' },
    ]);
    expect(document.body.textContent).toContain('Imported 1 models.');
  });
});
