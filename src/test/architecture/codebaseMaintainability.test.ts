import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../..');

const readProjectFile = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const listProjectSourceFiles = (relativeDir: string): string[] => {
  const absoluteDir = path.join(projectRoot, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      return listProjectSourceFiles(entryPath);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });
};

describe('codebase maintainability guardrails', () => {
  it('does not keep identity wrapper exports in mainContentModels', () => {
    const source = readProjectFile('src/components/layout/mainContentModels.ts');

    expect(source).not.toContain('export const buildAppModalsProps =');
    expect(source).not.toContain('export const buildChatAreaInputActions =');
  });

  it('does not keep pure barrel files for split utilities and APIs', () => {
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/appUtils.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/modelHelpers.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/uiUtils.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/services/api/baseApi.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/features/chat/input/index.ts'))).toBe(false);
  });

  it('keeps model utility consumers on the split module names', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => relativePath !== 'src/test/architecture/codebaseMaintainability.test.ts')
      .filter((relativePath) => readProjectFile(relativePath).includes('modelHelpers'));

    expect(offenders).toEqual([]);
  });

  it('does not expose test-only implementation helpers from production modules', () => {
    const objectUrlManagerSource = readProjectFile('src/services/objectUrlManager.ts');
    const audioCompressionSource = readProjectFile('src/features/audio/audioCompression.ts');
    const modelCapabilitiesSource = readProjectFile('src/stores/modelCapabilitiesStore.ts');
    const chatRuntimeSource = readProjectFile('src/components/layout/chat-runtime/ChatRuntimeContext.tsx');

    expect(objectUrlManagerSource).not.toContain('export class ObjectUrlManager');
    expect(audioCompressionSource).not.toContain('export const createAudioCompressionWorkerCode');
    expect(audioCompressionSource).not.toContain('export const encodeMp3WithWorker');
    expect(modelCapabilitiesSource).not.toContain('export const useModelCapabilitiesStore');
    expect(chatRuntimeSource).not.toContain('export const useChatRuntimeValues');
  });

  it('inlines main content prop assembly and trims related interface surface', () => {
    const mainContentSource = readProjectFile('src/components/layout/MainContent.tsx');
    const mainContentViewModelSource = readProjectFile('src/components/layout/useMainContentViewModel.ts');
    const mainContentModelsSource = readProjectFile('src/components/layout/mainContentModels.ts');
    const settingsModalSource = readProjectFile('src/components/settings/SettingsModal.tsx');
    const headerSource = readProjectFile('src/components/header/Header.tsx');
    const historySidebarSource = readProjectFile('src/components/sidebar/HistorySidebar.tsx');
    const apiConfigSource = readProjectFile('src/components/settings/sections/ApiConfigSection.tsx');
    const iconsIndexSource = readProjectFile('src/components/icons/index.ts');

    expect(mainContentSource).not.toContain('buildHistorySidebarProps(');
    expect(mainContentSource).not.toContain('buildChatAreaModel(');
    expect(mainContentSource).toContain('useMainContentViewModel');
    expect(settingsModalSource).toContain('buildSettingsForModal');
    expect(settingsModalSource).toContain('splitScopedSettingsUpdate');
    expect(mainContentViewModelSource).toContain('buildSidePanelKey');
    expect(mainContentModelsSource).not.toContain('export const buildHistorySidebarProps =');
    expect(mainContentModelsSource).not.toContain('export const buildChatAreaModel =');
    expect(fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-area/ChatAreaContext.tsx'))).toBe(false);
    expect(headerSource).not.toContain('currentModelName?: string;');
    expect(historySidebarSource).not.toContain('isOpen?: boolean;');
    expect(apiConfigSource).not.toContain('serverManagedApi?: boolean;');
    expect(apiConfigSource).not.toContain('setLiveApiEphemeralTokenEndpoint?:');
    expect(iconsIndexSource).not.toContain("export * from './iconUtils';");
  });

  it('keeps the history sidebar out of the initial main-content chunk', () => {
    const mainContentSource = readProjectFile('src/components/layout/MainContent.tsx');

    expect(mainContentSource).not.toContain("import { HistorySidebar } from '@/components/sidebar/HistorySidebar';");
    expect(mainContentSource).toContain("import('@/components/sidebar/HistorySidebar')");
    expect(mainContentSource).toContain('LazyHistorySidebar');
  });

  it('keeps PiP availability independent from custom API config toggles', () => {
    const mainContentSource = readProjectFile('src/components/layout/MainContent.tsx');
    const mainContentViewModelSource = readProjectFile('src/components/layout/useMainContentViewModel.ts');
    const runtimeContextSource = readProjectFile('src/components/layout/chat-runtime/ChatRuntimeContext.tsx');

    expect(runtimeContextSource).toContain('isPipSupported: pipState.isPipSupported,');
    expect(mainContentSource).not.toContain('pipState.isPipSupported && appSettings.useCustomApiConfig');
    expect(mainContentViewModelSource).not.toContain('pipState.isPipSupported && appSettings.useCustomApiConfig');
    expect(runtimeContextSource).not.toContain('pipState.isPipSupported && appSettings.useCustomApiConfig');
  });

  it('keeps message-list scroll ownership local instead of routing scroll events back through chat state', () => {
    const chatScrollSource = readProjectFile('src/hooks/chat/useChatScroll.ts');
    const messageListSource = readProjectFile('src/components/chat/MessageList.tsx');

    expect(chatScrollSource).not.toContain('handleScroll =');
    expect(fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-area/ChatAreaContext.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-area/ChatAreaProps.ts'))).toBe(false);
    expect(messageListSource).not.toContain('onScrollContainerScroll');
  });

  it('routes preview and export plumbing through shared helpers', () => {
    const messageListUiSource = readProjectFile('src/hooks/useMessageListUi.ts');
    const chatInputFileSource = readProjectFile('src/hooks/chat-input/useChatInputFile.ts');
    const useAppSource = readProjectFile('src/hooks/app/useApp.ts');
    const useAppPromptModesSource = readProjectFile('src/hooks/app/useAppPromptModes.ts');
    const messageExportSource = readProjectFile('src/hooks/useMessageExport.ts');
    const chatSessionExportSource = readProjectFile('src/hooks/data-management/useChatSessionExport.ts');

    expect(messageListUiSource).toContain('useFileModalState');
    expect(chatInputFileSource).toContain('useChatInputFileUi');
    expect(useAppSource).toContain('useAppPromptModes');
    expect(useAppPromptModesSource).toContain('loadLiveArtifactsSystemPrompt');
    expect(messageExportSource).toContain("from '@/utils/export/runtime'");
    expect(chatSessionExportSource).toContain("from '@/utils/export/runtime'");
  });

  it('names grounded response helpers after their citation source role', () => {
    expect(fs.existsSync(path.join(projectRoot, 'src/components/message/grounded-response/groundingSources.ts'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(projectRoot, 'src/components/message/grounded-response/utils.ts'))).toBe(false);
  });

  it('names local Python file helpers after their execution-file role', () => {
    expect(fs.existsSync(path.join(projectRoot, 'src/features/local-python/executionFiles.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/features/local-python/helpers.ts'))).toBe(false);
  });

  it('does not keep sanitizeSessionForExport as an identity wrapper', () => {
    const source = readProjectFile('src/utils/chat/session.ts');

    expect(source).toContain('export const stripSessionFilePayloads =');
    expect(source).not.toContain('sanitizeSessionForExport');
    expect(source).not.toContain('updateSessionWithNewMessages');
  });

  it('keeps chat store selectors close to their consumer instead of behind a bulk binding hook', () => {
    const chatHookSource = readProjectFile('src/hooks/chat/useChat.ts');

    expect(chatHookSource).toContain("from '@/stores/chatStore'");
    expect(chatHookSource).not.toContain('useChatStoreBindings');
    expect(fs.existsSync(path.join(projectRoot, 'src/hooks/chat/useChatStoreBindings.ts'))).toBe(false);
  });

  it('uses function APIs directly instead of the Gemini service wrapper', () => {
    const apiTypesSource = readProjectFile('src/types/api.ts');
    const sourceFiles = ['src/hooks', 'src/components', 'src/services'].flatMap(listProjectSourceFiles);

    expect(apiTypesSource).not.toContain('interface GeminiService');
    expect(fs.existsSync(path.join(projectRoot, 'src/services/geminiService.ts'))).toBe(false);

    for (const relativePath of sourceFiles) {
      const source = readProjectFile(relativePath);
      expect(source).not.toContain('geminiServiceInstance');
      expect(source).not.toContain('services/geminiService');
    }
  });

  it('keeps standard chat sender on the shared optimistic message pipeline', () => {
    const source = readProjectFile('src/features/message-sender/standardChatStrategy.ts');

    expect(source).toContain('runOptimisticMessagePipeline');
    expect(source).not.toContain('useStandardChatSession');
    expect(source).toContain('resolveStandardChatTurn');
    expect(source).toContain('performStandardChatApiCall');
    expect(source).not.toContain('performOptimisticSessionUpdate');
    expect(source).not.toContain('generateSessionTitle');
    expect(fs.existsSync(path.join(projectRoot, 'src/features/message-sender/useStandardChatSession.ts'))).toBe(false);
    expect(source.length).toBeLessThan(21000);
  });

  it('keeps senders on the shared optimistic message pipeline', () => {
    for (const relativePath of [
      'src/features/message-sender/standardChatStrategy.ts',
      'src/features/message-sender/ttsImagenStrategy.ts',
      'src/features/message-sender/imageEditStrategy.ts',
    ]) {
      const source = readProjectFile(relativePath);

      expect(source).toContain('runOptimisticMessagePipeline');
      expect(source).not.toContain('performOptimisticSessionUpdate');
      expect(source).not.toContain('generateSessionTitle');
      expect(source).not.toContain('DEFAULT_CHAT_SETTINGS');
    }
  });

  it('keeps message sender lifecycle centralized instead of duplicating sender hooks', () => {
    const mainSenderSource = readProjectFile('src/features/message-sender/useMessageSender.ts');

    expect(mainSenderSource).toContain('useMessageLifecycle');
    expect(mainSenderSource).toMatch(/const \{ runMessageLifecycle \} = useMessageLifecycle\(/);

    for (const hookName of [
      'useStandardChat',
      'useLiveArtifactsGenerator',
      'useTtsImagenSender',
      'useImageEditSender',
    ]) {
      expect(mainSenderSource).not.toContain(hookName);
      expect(fs.existsSync(path.join(projectRoot, `src/features/message-sender/${hookName}.ts`))).toBe(false);
    }

    const senderFiles = listProjectSourceFiles('src/features/message-sender');
    const lifecycleConsumers = senderFiles.filter(
      (relativePath) =>
        !relativePath.endsWith('.test.tsx') &&
        relativePath !== 'src/features/message-sender/useMessageLifecycle.ts' &&
        readProjectFile(relativePath).includes('useMessageLifecycle'),
    );
    expect(lifecycleConsumers).toEqual([
      'src/features/message-sender/messagePipeline.ts',
      'src/features/message-sender/useMessageSender.ts',
    ]);
  });

  it('keeps model generation settings behind a unified settings update interface', () => {
    const modelsSectionSource = readProjectFile('src/components/settings/sections/ModelsSection.tsx');
    const generationSectionSource = readProjectFile('src/components/settings/sections/GenerationSection.tsx');

    expect(generationSectionSource).toContain('currentSettings: AppSettings;');
    expect(generationSectionSource).toContain('onUpdateSetting: <K extends keyof AppSettings>');
    expect(modelsSectionSource).toContain('currentSettings={currentSettings}');
    expect(modelsSectionSource).toContain('onUpdateSetting={updateSetting}');

    for (const propName of [
      'setSystemInstruction',
      'setTemperature',
      'setTopP',
      'setTopK',
      'setThinkingBudget',
      'setThinkingLevel',
      'setShowThoughts',
      'setMediaResolution',
      'setTtsVoice',
      'setIsRawModeEnabled',
      'setHideThinkingInContext',
    ]) {
      expect(modelsSectionSource).not.toContain(`${propName}={`);
      expect(generationSectionSource).not.toContain(`${propName}:`);
    }
  });

  it('removes the unused parallel settings component tree', () => {
    const settingsContentSource = readProjectFile('src/components/settings/SettingsContent.tsx');
    const settingsSourceFiles = listProjectSourceFiles('src/components/settings');

    for (const relativePath of [
      'src/components/settings/sections/ChatBehaviorSection.tsx',
      'src/components/settings/sections/ChatBehaviorSection.test.tsx',
      'src/components/settings/ModelVoiceSettings.tsx',
      'src/components/settings/ModelVoiceSettings.test.tsx',
      'src/components/settings/ModelVoiceSettings.interaction.test.tsx',
    ]) {
      expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(false);
    }

    for (const relativePath of settingsSourceFiles) {
      const source = readProjectFile(relativePath);
      expect(source).not.toContain('ChatBehaviorSection');
      expect(source).not.toContain('ModelVoiceSettings');
    }

    expect(settingsContentSource).toContain("from './sections/ModelsSection'");
  });

  it('keeps model settings panels on the shared settings object contract', () => {
    const modelsSectionSource = readProjectFile('src/components/settings/sections/ModelsSection.tsx');
    const languageVoiceSectionSource = readProjectFile('src/components/settings/sections/LanguageVoiceSection.tsx');
    const liveArtifactsSectionSource = readProjectFile('src/components/settings/sections/LiveArtifactsSection.tsx');

    for (const source of [languageVoiceSectionSource, liveArtifactsSectionSource]) {
      expect(source).toContain('currentSettings: AppSettings;');
      expect(source).toContain('onUpdateSetting: SettingsUpdateHandler;');
    }

    for (const source of [modelsSectionSource, languageVoiceSectionSource, liveArtifactsSectionSource]) {
      for (const propName of [
        'setTranscriptionModelId',
        'setTtsVoice',
        'setSystemInstruction',
        'setTemperature',
        'setTopP',
        'setTopK',
        'setThinkingBudget',
        'setThinkingLevel',
        'setShowThoughts',
        'setMediaResolution',
        'setTranslationTargetLanguage',
        'setInputTranslationModelId',
        'setThoughtTranslationTargetLanguage',
        'setThoughtTranslationModelId',
        'setAutoLiveArtifactsVisualization',
        'setAutoLiveArtifactsModelId',
      ]) {
        expect(source).not.toContain(`${propName}:`);
      }
    }

    for (const source of [modelsSectionSource]) {
      for (const propName of [
        'setTranscriptionModelId',
        'setTtsVoice',
        'setSystemInstruction',
        'setTemperature',
        'setTopP',
        'setTopK',
        'setThinkingBudget',
        'setThinkingLevel',
        'setShowThoughts',
        'setMediaResolution',
        'setTranslationTargetLanguage',
        'setInputTranslationModelId',
        'setThoughtTranslationTargetLanguage',
        'setThoughtTranslationModelId',
        'setAutoLiveArtifactsVisualization',
        'setAutoLiveArtifactsModelId',
      ]) {
        expect(source).not.toContain(`${propName}={`);
      }
    }
  });

  it('reuses the shared chat settings updater type for store-backed chat area contracts', () => {
    const chatRuntimeContextSource = readProjectFile('src/components/layout/chat-runtime/ChatRuntimeContext.tsx');
    const chatStoreSource = readProjectFile('src/stores/chatStore.ts');

    for (const source of [chatRuntimeContextSource, chatStoreSource]) {
      expect(source).toContain('ChatSettingsUpdater');
      expect(source).not.toContain('(updater: (prevSettings: ChatSettings) => ChatSettings) => void;');
      expect(source).not.toContain('(updater: (prev: ChatSettings) => ChatSettings) => void;');
    }
  });

  it('removes low-risk unused interface surface from selected modules', () => {
    const modelSelectorSource = readProjectFile('src/components/settings/controls/ModelSelector.tsx');
    const liveConfigSource = readProjectFile('src/hooks/live-api/useLiveConfig.ts');
    const liveConnectionSource = readProjectFile('src/hooks/live-api/useLiveConnection.ts');
    const historySidebarSource = readProjectFile('src/components/sidebar/HistorySidebar.tsx');

    expect(modelSelectorSource).not.toMatch(/\bt:\s*\(key:\s*string\)\s*=>\s*string;/);
    expect(liveConfigSource).not.toContain('appSettings: AppSettings;');
    expect(liveConnectionSource).not.toContain('chatSettings: ChatSettings;');
    expect(historySidebarSource).not.toContain("language?: 'en' | 'zh';");
  });

  it('keeps settings and history import/export actions local to settings modals', () => {
    const appSource = readProjectFile('src/hooks/app/useApp.ts');
    const mainContentViewModelSource = readProjectFile('src/components/layout/useMainContentViewModel.ts');
    const appModalsSource = readProjectFile('src/components/modals/AppModals.tsx');
    const settingsModalSource = readProjectFile('src/components/settings/SettingsModal.tsx');

    for (const propName of [
      'handleImportSettings',
      'handleExportSettings',
      'handleImportHistory',
      'handleExportHistory',
    ]) {
      expect(appSource).not.toContain(propName);
      expect(mainContentViewModelSource).not.toContain(propName);
      expect(appModalsSource).not.toContain(`${propName}:`);
      expect(appModalsSource).not.toContain(`${propName},`);
    }

    expect(settingsModalSource).toContain('useSettingsTransferActions');
  });

  it('builds settings load state through shared helpers instead of duplicate branches', () => {
    const settingsStoreSource = readProjectFile('src/stores/settingsStore.ts');

    expect(settingsStoreSource).toContain('function buildLoadedAppSettings');
    expect(settingsStoreSource).toContain('function persistLoadedPreloadOverrides');
    expect(settingsStoreSource).not.toContain('if (storedSettings) {');
  });

  it('routes named lazy component imports through a shared helper', () => {
    const helperSource = readProjectFile('src/utils/lazyNamedComponent.ts');
    expect(helperSource).toContain('loadNamedComponent');
    expect(helperSource).toContain('lazyNamedComponent');

    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/codebaseMaintainability.test.ts',
    );

    for (const relativePath of sourceFiles) {
      const source = readProjectFile(relativePath);
      expect(source, relativePath).not.toMatch(/lazy\(async \(\) => \{/);
      expect(source, relativePath).not.toMatch(/return\s+\{\s*default:\s*module\./);
    }
  });

  it('keeps model icon rendering separate from the ModelPicker component', () => {
    const modelPickerSource = readProjectFile('src/components/shared/ModelPicker.tsx');
    const modelListViewSource = readProjectFile('src/components/settings/controls/model-selector/ModelListView.tsx');
    const modelListEditorRowSource = readProjectFile(
      'src/components/settings/controls/model-selector/ModelListEditorRow.tsx',
    );
    const tokenCountModalSource = readProjectFile('src/components/modals/TokenCountModal.tsx');

    expect(fs.existsSync(path.join(projectRoot, 'src/components/shared/modelIcons.tsx'))).toBe(true);
    expect(modelPickerSource).toContain("from './modelIcons'");
    expect(modelPickerSource).not.toContain('export const getModelIcon =');
    expect(modelListViewSource).toContain("from '@/components/shared/modelIcons'");
    expect(modelListEditorRowSource).toContain("from '@/components/shared/modelIcons'");
    expect(tokenCountModalSource).toContain("from '@/components/shared/modelIcons'");
  });

  it('keeps PNG export color sanitizing separate from DOM export orchestration', () => {
    const domExportSource = readProjectFile('src/utils/export/dom.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/export/cssColorSanitizer.ts'))).toBe(true);
    expect(domExportSource).toContain("from './cssColorSanitizer'");
    expect(domExportSource).not.toContain('parseOklchColor');
    expect(domExportSource).not.toContain('convertColorMixToRgba');
  });

  it('keeps import-context ignore matching and security scanning in focused modules', () => {
    const importContextBuilderSource = readProjectFile('src/utils/import-context/importContextBuilder.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/import-context/ignoreMatcher.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/import-context/securityScan.ts'))).toBe(true);
    expect(importContextBuilderSource).toContain("from './ignoreMatcher'");
    expect(importContextBuilderSource).toContain("from './securityScan'");
    expect(importContextBuilderSource).not.toContain('const SECURITY_RULES');
    expect(importContextBuilderSource).not.toContain('function createIgnoreMatcher');
  });

  it('isolates scoped chat runtime context from sidebar and modal prop assembly', () => {
    const mainContentSource = readProjectFile('src/components/layout/MainContent.tsx');
    const mainContentViewModelSource = readProjectFile('src/components/layout/useMainContentViewModel.ts');
    const runtimeContextSource = readProjectFile('src/components/layout/chat-runtime/ChatRuntimeContext.tsx');

    expect(mainContentSource).toContain('ChatRuntimeProvider');
    expect(mainContentViewModelSource).not.toContain('useChatRuntimeBridge');
    expect(mainContentViewModelSource).not.toContain('setChatRuntime');
    expect(mainContentViewModelSource).not.toContain('const chatRuntime = useMemo');
    expect(runtimeContextSource).toContain('ChatHeaderRuntimeContext');
    expect(runtimeContextSource).toContain('ChatMessageListRuntimeContext');
    expect(runtimeContextSource).toContain('ChatInputRuntimeContext');
  });

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
});
