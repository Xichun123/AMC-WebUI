import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { listProjectSourceFilesExcept, projectRoot, readProjectFile } from './projectFiles';

describe('state persistence boundaries', () => {
  it('uses store-level message actions for repeated session/message updates', () => {
    const chatStoreSource = readProjectFile('src/stores/chatStore.ts');
    const suggestionsSource = readProjectFile('src/hooks/chat/useSuggestions.ts');
    const messageUpdatesSource = readProjectFile('src/hooks/chat/actions/useMessageUpdates.ts');

    expect(chatStoreSource).toContain('updateMessageInSession:');
    expect(chatStoreSource).toContain('updateMessageInActiveSession:');
    expect(chatStoreSource).toContain('appendMessageToSession:');
    expect(suggestionsSource).toContain('updateMessageInSession');
    expect(messageUpdatesSource).toContain('updateMessageInActiveSession');
  });

  it('routes lightweight frontend persistence through shared persisted stores', () => {
    const chatInputStateSource = readProjectFile('src/hooks/chat-input/useChatInputState.ts');
    const settingsLogicSource = readProjectFile('src/hooks/settings/useSettingsLogic.ts');
    const useModelsSource = readProjectFile('src/hooks/core/useModels.ts');
    const uiStoreSource = readProjectFile('src/stores/uiStore.ts');
    const modelSwitchSettingsSource = readProjectFile('src/utils/modelSwitchSettings.ts');

    expect(chatInputStateSource).toContain('useChatDraftStore');
    expect(settingsLogicSource).toContain('useSettingsUiStore');
    expect(useModelsSource).toContain('useModelPreferencesStore');
    expect(uiStoreSource).toContain('persistentStorage');
    expect(modelSwitchSettingsSource).toContain('useModelPreferencesStore');

    for (const [relativePath, source] of [
      ['src/hooks/chat-input/useChatInputState.ts', chatInputStateSource],
      ['src/hooks/settings/useSettingsLogic.ts', settingsLogicSource],
      ['src/hooks/core/useModels.ts', useModelsSource],
      ['src/stores/uiStore.ts', uiStoreSource],
      ['src/utils/modelSwitchSettings.ts', modelSwitchSettingsSource],
    ] as const) {
      expect(source, relativePath).not.toContain('localStorage.');
      expect(source, relativePath).not.toContain("addEventListener('storage'");
      expect(source, relativePath).not.toContain('new StorageEvent');
    }
  });

  it('centralizes store updater-or-value helpers', () => {
    const storeFiles = listProjectSourceFilesExcept('src/stores', 'src/stores/stateUpdaters.ts');
    const duplicatedUpdaterTypeOffenders = storeFiles.filter((relativePath) =>
      readProjectFile(relativePath).includes('type UpdaterOrValue<T> ='),
    );

    expect(fs.existsSync(path.join(projectRoot, 'src/stores/stateUpdaters.ts'))).toBe(true);
    expect(readProjectFile('src/stores/stateUpdaters.ts')).toContain('resolveUpdaterOrValue');
    expect(duplicatedUpdaterTypeOffenders).toEqual([]);
  });
});
