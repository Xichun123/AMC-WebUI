import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { listProjectSourceFiles, projectRoot, readProjectFile } from './projectFiles';

describe('detail quality boundaries', () => {
  it('reuses dropped-item snapshotting without pulling folder import code into the initial bundle', () => {
    const useFileDragDropSource = readProjectFile('src/hooks/file-upload/useFileDragDrop.ts');
    const droppedItemsSource = readProjectFile('src/utils/import-context/droppedItems.ts');
    const droppedItemsSnapshotSource = readProjectFile('src/utils/import-context/droppedItemsSnapshot.ts');

    expect(droppedItemsSnapshotSource).toContain('export function snapshotDroppedItems');
    expect(droppedItemsSource).toContain("from './droppedItemsSnapshot'");
    expect(useFileDragDropSource).toContain("from '@/utils/import-context/droppedItemsSnapshot'");
    expect(useFileDragDropSource).toContain("import('@/utils/import-context/droppedItems')");
    expect(useFileDragDropSource).not.toContain("from '@/utils/import-context/droppedItems'");
    expect(useFileDragDropSource).not.toContain('const snapshotDroppedItems =');
    expect(useFileDragDropSource).not.toContain('interface DroppedItemsSnapshot');
  });

  it('keeps combined prompt scratch files out of the repository root', () => {
    expect(fs.existsSync(path.join(projectRoot, 'deep-search-live-artifacts-prompt.txt'))).toBe(false);
  });

  it('keeps message sender validation in a named helper module', () => {
    const useMessageSenderSource = readProjectFile('src/features/message-sender/useMessageSender.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/features/message-sender/sendMessageValidation.ts'))).toBe(true);
    expect(useMessageSenderSource).toContain("from './sendMessageValidation'");
    expect(useMessageSenderSource).toContain('validateMessageBeforeSend({');
    expect(useMessageSenderSource).not.toContain('const imageReferenceCount = filesToUse.filter');
    expect(useMessageSenderSource).not.toContain('messageSender_imagenTextOnly');
  });

  it('keeps API adapters independent of chat-streaming reducer internals', () => {
    const apiSourceFiles = listProjectSourceFiles('src/services/api');
    const reducerImportOffenders = apiSourceFiles.filter((relativePath) =>
      readProjectFile(relativePath).includes('@/features/chat-streaming/messageStreamReducer'),
    );
    const adapterSource = readProjectFile('src/services/api/chatResponseAdapter.ts');

    expect(reducerImportOffenders).toEqual([]);
    expect(adapterSource).toContain("from '@/utils/groundingMetadata'");
  });

  it('keeps message stream reducer focused on state transitions', () => {
    const reducerSource = readProjectFile('src/features/chat-streaming/messageStreamReducer.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/features/chat-streaming/messageStreamParts.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/features/chat-streaming/messageStreamMetadata.ts'))).toBe(true);
    expect(reducerSource).toContain("from './messageStreamParts'");
    expect(reducerSource).toContain("from './messageStreamMetadata'");
    expect(reducerSource).toContain("from '@/utils/groundingMetadata'");

    for (const reducerHelperExport of [
      'export const appendApiPart',
      'export const getContentDeltaFromPart',
      'export const mergeUsageMetadata',
      'export const mergeGroundingMetadata',
      'export const mergeUrlContextMetadata',
    ]) {
      expect(reducerSource).not.toContain(reducerHelperExport);
    }
  });

  it('imports stream part helpers from their focused module', () => {
    const processorsSource = readProjectFile('src/features/chat-streaming/processors.ts');
    const imageEditStrategySource = readProjectFile('src/features/message-sender/imageEditStrategy.ts');

    expect(processorsSource).not.toContain('appendApiPart');
    expect(imageEditStrategySource).toContain('@/features/chat-streaming/messageStreamParts');
  });

  it('names Live Artifacts prompt translations after the prompt action', () => {
    const sources = [
      'src/components/header/Header.tsx',
      'src/i18n/translations/header.ts',
      'src/i18n/translations/common.ts',
    ].map(readProjectFile);

    for (const source of sources) {
      expect(source).not.toContain('liveArtifactsHelper');
    }

    expect(readProjectFile('src/components/header/Header.tsx')).toContain('liveArtifactsPromptActive_aria');
  });

  it('uses one named MIME type for directory placeholders', () => {
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => !relativePath.includes('/test/') && !relativePath.endsWith('.test.tsx'),
    );
    const literalOffenders = sourceFiles.filter(
      (relativePath) =>
        relativePath !== 'src/utils/file-upload/fileUploadPolicy.ts' &&
        readProjectFile(relativePath).includes('application/x-directory'),
    );
    const policySource = readProjectFile('src/utils/file-upload/fileUploadPolicy.ts');

    expect(literalOffenders).toEqual([]);
    expect(policySource).toContain('DIRECTORY_PLACEHOLDER_MIME_TYPE');
  });

  it('builds HTML preview sanitizer scripts from the runtime sanitizer constants', () => {
    const sanitizerSource = readProjectFile('src/utils/html-preview/previewSanitizer.ts');

    expect(sanitizerSource).toContain('DANGEROUS_PREVIEW_URL_ATTRIBUTES');
    expect(sanitizerSource).toContain('DANGEROUS_PREVIEW_ATTRIBUTE_NAMES');
    expect(sanitizerSource).not.toContain("attributeName === 'src' || attributeName === 'href'");
    expect(sanitizerSource).not.toContain("attributeName === 'srcdoc'");
  });

  it('keeps HTML preview runtime scripts split by responsibility', () => {
    const expectedFiles = [
      'src/utils/html-preview/previewDocument.ts',
      'src/utils/html-preview/previewMessageProtocol.ts',
      'src/utils/html-preview/previewSanitizer.ts',
      'src/utils/html-preview/previewBridgeScript.ts',
      'src/utils/html-preview/streamingPreviewRunnerScript.ts',
    ];

    for (const relativePath of expectedFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/htmlPreview.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/htmlPreviewScripts.ts'))).toBe(false);

    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/detailQualityBoundaries.test.ts',
    );
    const oldImportOffenders = sourceFiles.filter((relativePath) => {
      const source = readProjectFile(relativePath);
      return source.includes('@/utils/htmlPreview') || source.includes('./htmlPreview');
    });

    expect(oldImportOffenders).toEqual([]);
  });

  it('keeps import context lazy loaders with the import-context feature modules', () => {
    const loaderPath = 'src/utils/import-context/loaders.ts';
    const loaderSource = readProjectFile(loaderPath);
    const useFilePreProcessingSource = readProjectFile('src/hooks/file-upload/useFilePreProcessing.ts');
    const useFilePreProcessingEffectsSource = readProjectFile('src/hooks/chat-input/useFilePreProcessingEffects.ts');

    expect(fs.existsSync(path.join(projectRoot, loaderPath))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/importContextLoaders.ts'))).toBe(false);
    expect(loaderSource).toContain("import('./importContextBuilder')");
    expect(useFilePreProcessingSource).toContain("import('@/utils/import-context/loaders')");
    expect(useFilePreProcessingEffectsSource).toContain("import('@/utils/import-context/loaders')");
  });

  it('keeps import-context shared details split into named helper modules', () => {
    const expectedHelperFiles = [
      'src/utils/import-context/defaultIgnorePatterns.ts',
      'src/utils/import-context/languageMap.ts',
      'src/utils/import-context/textStats.ts',
      'src/utils/import-context/treeSorting.ts',
    ];
    const importContextFiles = listProjectSourceFiles('src/utils/import-context');

    for (const relativePath of expectedHelperFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/import-context/shared.ts'))).toBe(false);

    for (const relativePath of importContextFiles) {
      const source = readProjectFile(relativePath);
      expect(source, relativePath).not.toContain("from './shared'");
    }
  });

  it('keeps audio compression worker source in its own code module', () => {
    const audioCompressionSource = readProjectFile('src/features/audio/audioCompression.ts');
    const workerCodeSource = readProjectFile('src/features/audio/audioCompressionWorkerCode.ts');

    expect(workerCodeSource).toContain('export const audioCompressionWorkerCode');
    expect(audioCompressionSource).toContain("from './audioCompressionWorkerCode'");
    expect(audioCompressionSource).not.toContain('const WORKER_CODE');
    expect(audioCompressionSource).not.toContain('importScripts(');
  });

  it('keeps broad constants split into named domain modules', () => {
    const expectedConstantModules = [
      'src/constants/settingsDefaults.ts',
      'src/constants/safetySettings.ts',
      'src/constants/translationOptions.ts',
      'src/constants/welcomeSuggestions.ts',
      'src/constants/focusClasses.ts',
      'src/constants/buttonClasses.ts',
      'src/constants/menuClasses.ts',
      'src/constants/formClasses.ts',
    ];

    for (const relativePath of expectedConstantModules) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }

    expect(fs.existsSync(path.join(projectRoot, 'src/constants/appConstants.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/styleClasses.ts'))).toBe(false);

    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/detailQualityBoundaries.test.ts',
    );
    const broadConstantImportOffenders = sourceFiles.filter((relativePath) => {
      const source = readProjectFile(relativePath);
      return source.includes('@/constants/appConstants') || source.includes('@/constants/styleClasses');
    });

    expect(broadConstantImportOffenders).toEqual([]);
  });

  it('keeps focused test helpers in named subdirectories', () => {
    const expectedHelperFiles = [
      'src/test/browser/environment.ts',
      'src/test/chat-area/fixtures.tsx',
      'src/test/chat-input/contextFixtures.ts',
      'src/test/chat-input/harness.tsx',
      'src/test/chat-tools/fixtures.ts',
      'src/test/data/factories.ts',
      'src/test/doubles/moduleMocks.ts',
      'src/test/doubles/services.ts',
      'src/test/doubles/i18n.ts',
      'src/test/hooks/factories.ts',
      'src/test/live-api/fixtures.ts',
      'src/test/message-list/doubles.tsx',
      'src/test/render/providerRenderer.tsx',
      'src/test/render/renderer.tsx',
      'src/test/stores/reset.ts',
    ];
    const retiredRootHelpers = [
      'src/test/browserEnvironment.ts',
      'src/test/chatAreaFixtures.tsx',
      'src/test/chatInputContextFixtures.ts',
      'src/test/chatInputHarness.tsx',
      'src/test/chatToolFixtures.ts',
      'src/test/factories.ts',
      'src/test/hookFactories.ts',
      'src/test/i18nTestDoubles.ts',
      'src/test/liveApiFixtures.ts',
      'src/test/messageListTestDoubles.tsx',
      'src/test/moduleMockDoubles.ts',
      'src/test/providerTestUtils.tsx',
      'src/test/render/providerTestUtils.tsx',
      'src/test/render/testUtils.tsx',
      'src/test/serviceTestDoubles.ts',
      'src/test/storeTestUtils.ts',
      'src/test/testUtils.tsx',
    ];

    for (const relativePath of expectedHelperFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }

    for (const relativePath of retiredRootHelpers) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(false);
    }

    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/detailQualityBoundaries.test.ts',
    );
    const retiredHelperImportOffenders = sourceFiles.filter((relativePath) => {
      const source = readProjectFile(relativePath);
      return (
        /@\/test\/(?:browserEnvironment|chatAreaFixtures|chatInputContextFixtures|chatInputHarness|chatToolFixtures|factories|hookFactories|i18nTestDoubles|liveApiFixtures|messageListTestDoubles|moduleMockDoubles|providerTestUtils|serviceTestDoubles|storeTestUtils|testUtils)\b/.test(
          source,
        ) || /@\/test\/render\/(?:providerTestUtils|testUtils)\b/.test(source)
      );
    });

    expect(retiredHelperImportOffenders).toEqual([]);
  });

  it('keeps log usage tracking out of the core log service', () => {
    const logServiceSource = readProjectFile('src/services/logService.ts');
    const usageTrackerSource = readProjectFile('src/services/logUsageTracker.ts');

    expect(logServiceSource).toContain("from './logUsageTracker'");
    expect(logServiceSource).not.toContain('API_USAGE_STORAGE_KEY');
    expect(logServiceSource).not.toContain('TOKEN_USAGE_STORAGE_KEY');
    expect(usageTrackerSource).toContain('class ApiKeyUsageTracker');
    expect(usageTrackerSource).toContain('class TokenUsageTracker');
  });

  it('keeps chat export React rendering out of generic export utilities', () => {
    const chatSessionExportSource = readProjectFile('src/hooks/data-management/useChatSessionExport.ts');
    const exportUtilityFiles = listProjectSourceFiles('src/utils/export');
    const componentImportOffenders = exportUtilityFiles.filter((relativePath) =>
      readProjectFile(relativePath).includes('@/components/'),
    );

    expect(fs.existsSync(path.join(projectRoot, 'src/features/chat-export/chatExportRenderer.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/export/conversation.ts'))).toBe(false);
    expect(componentImportOffenders).toEqual([]);
    expect(chatSessionExportSource).toContain("from '@/features/chat-export/chatExportRenderer'");
  });

  it('does not pass the virtualized scroll container into full-session export', () => {
    const chatSessionExportSource = readProjectFile('src/hooks/data-management/useChatSessionExport.ts');
    const useAppSource = readProjectFile('src/hooks/app/useApp.ts');
    const exportHookStart = useAppSource.indexOf('useChatSessionExport({');
    const exportHookEnd = useAppSource.indexOf('  });', exportHookStart);
    const exportHookCall = useAppSource.slice(exportHookStart, exportHookEnd);

    expect(chatSessionExportSource).not.toContain('scrollContainerRef');
    expect(exportHookCall).not.toContain('scrollContainerRef');
  });

  it('keeps stream part tests next to the stream part helpers', () => {
    const processorsTestSource = readProjectFile('src/features/chat-streaming/processors.test.ts');
    const partsTestPath = path.join(projectRoot, 'src/features/chat-streaming/messageStreamParts.test.ts');

    expect(fs.existsSync(partsTestPath)).toBe(true);
    expect(processorsTestSource).not.toContain('appendApiPart');
    expect(processorsTestSource).not.toContain('@/utils/chat/parsing');
    expect(processorsTestSource).not.toContain('@/utils/chat/ids');
    expect(readProjectFile('src/features/chat-streaming/messageStreamParts.test.ts')).toContain(
      "describe('appendApiPart'",
    );
  });
});
