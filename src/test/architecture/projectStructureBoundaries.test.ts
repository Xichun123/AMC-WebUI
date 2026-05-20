import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

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

const countLines = (source: string): number => source.split('\n').length;

describe('project structure boundaries', () => {
  it('keeps legacy preference hydration inside effect boundaries', () => {
    const settingsLogicSource = readProjectFile('src/hooks/settings/useSettingsLogic.ts');
    const modelsHookSource = readProjectFile('src/hooks/core/useModels.ts');

    expect(settingsLogicSource).toMatch(
      /useEffect\(\(\) => \{\s*useSettingsUiStore\.getState\(\)\.hydrateLegacySettingsUiPreferences\(\);\s*\}, \[\]\);/,
    );
    expect(modelsHookSource).toMatch(
      /useEffect\(\(\) => \{\s*useModelPreferencesStore\.getState\(\)\.hydrateLegacyModelPreferences\(\);\s*\}, \[\]\);/,
    );
  });

  it('exports settings tab types from the settings UI store boundary', () => {
    const settingsLogicSource = readProjectFile('src/hooks/settings/useSettingsLogic.ts');
    const settingsSidebarSource = readProjectFile('src/components/settings/SettingsSidebar.tsx');
    const settingsContentSource = readProjectFile('src/components/settings/SettingsContent.tsx');

    expect(settingsLogicSource).not.toContain('export type { SettingsTab, SettingsTabDescriptor };');
    expect(settingsSidebarSource).toContain("from '@/stores/settingsUiStore'");
    expect(settingsSidebarSource).not.toContain("from '@/hooks/settings/useSettingsLogic'");
    expect(settingsContentSource).toContain("from '@/stores/settingsUiStore'");
    expect(settingsContentSource).not.toContain("from '@/hooks/settings/useSettingsLogic'");
  });

  it('keeps domain hooks out of the ambiguous hooks/features directory', () => {
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/projectStructureBoundaries.test.ts',
    );

    expect(fs.existsSync(path.join(projectRoot, 'src/hooks/features'))).toBe(false);

    for (const relativePath of sourceFiles) {
      const source = readProjectFile(relativePath);
      expect(source, relativePath).not.toContain('@/hooks/features/');
    }
  });

  it('uses the icons directory index instead of a CustomIcons compatibility barrel', () => {
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/projectStructureBoundaries.test.ts',
    );

    expect(fs.existsSync(path.join(projectRoot, 'src/components/icons/index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/components/icons/CustomIcons.tsx'))).toBe(false);

    for (const relativePath of sourceFiles) {
      const source = readProjectFile(relativePath);
      expect(source, relativePath).not.toContain('@/components/icons/CustomIcons');
      expect(source, relativePath).not.toContain('./CustomIcons');
    }
  });

  it('keeps general app icons separate from code language icons', () => {
    const generalIconsSource = readProjectFile('src/components/icons/groups/GeneralIcons.tsx');
    const languageIconsSource = readProjectFile('src/components/icons/groups/LanguageIcons.tsx');
    const iconsIndexSource = readProjectFile('src/components/icons/index.ts');

    expect(generalIconsSource).not.toContain('LanguageMark');
    expect(generalIconsSource).not.toContain('IconPython');
    expect(languageIconsSource).toContain('IconPython');
    expect(iconsIndexSource).toContain("export * from './groups/LanguageIcons';");
  });

  it('keeps architecture guard files focused and permanently named', () => {
    const architectureFiles = listProjectSourceFiles('src/test/architecture').filter((relativePath) =>
      relativePath.endsWith('.test.ts'),
    );
    const temporaryNamePattern = /(?:^|[-_.])(?:cleanup|review)(?:[-_.]|$)/i;
    const temporaryNames = architectureFiles.filter((relativePath) =>
      temporaryNamePattern.test(path.basename(relativePath)),
    );
    const oversizedFiles = architectureFiles
      .map((relativePath) => ({
        relativePath,
        lines: countLines(readProjectFile(relativePath)),
      }))
      .filter(({ lines }) => lines > 500);

    expect(temporaryNames).toEqual([]);
    expect(oversizedFiles).toEqual([]);
  });

  it('keeps OpenAI-compatible file names and imports on the same lower-camel spelling', () => {
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/projectStructureBoundaries.test.ts',
    );
    const discouragedOpenAiSpelling = `open${'AI'}`;
    const openAiFilenameOffenders = sourceFiles.filter((relativePath) =>
      path.basename(relativePath).includes(discouragedOpenAiSpelling),
    );
    const openAiSpellingOffenders = sourceFiles.filter((relativePath) =>
      readProjectFile(relativePath).includes(discouragedOpenAiSpelling),
    );

    expect(openAiFilenameOffenders).toEqual([]);
    expect(openAiSpellingOffenders).toEqual([]);
  });

  it('keeps IndexedDB migration comments complete across schema versions', () => {
    const dbServiceSource = readProjectFile('src/services/db/dbService.ts');

    expect(dbServiceSource).toContain('const DB_VERSION = 5;');
    for (const version of [1, 2, 3, 4, 5]) expect(dbServiceSource).toContain(`Version ${version}:`);
  });

  it('keeps Live API hook names on the same Api casing as the rest of the codebase', () => {
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/projectStructureBoundaries.test.ts',
    );
    const discouragedLiveApiSpellings = [`Live${'API'}`, `live${'API'}`, `useLive${'API'}`];
    const liveApiFilenameOffenders = sourceFiles.filter((relativePath) =>
      discouragedLiveApiSpellings.some((spelling) => path.basename(relativePath).includes(spelling)),
    );
    const liveApiSourceOffenders = sourceFiles.filter((relativePath) => {
      const source = readProjectFile(relativePath);
      return discouragedLiveApiSpellings.some((spelling) => source.includes(spelling));
    });

    expect(liveApiFilenameOffenders).toEqual([]);
    expect(liveApiSourceOffenders).toEqual([]);
  });

  it('keeps UI hook filenames on the same Ui acronym casing as other local acronyms', () => {
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/projectStructureBoundaries.test.ts',
    );
    const coreHookFileNames = fs.readdirSync(path.join(projectRoot, 'src/hooks/core'));
    const rootHookFileNames = fs.readdirSync(path.join(projectRoot, 'src/hooks'));

    expect(coreHookFileNames).not.toContain('useAppUI.ts');
    expect(rootHookFileNames).not.toContain('useMessageListUI.ts');
    expect(coreHookFileNames).toContain('useAppUi.ts');
    expect(rootHookFileNames).toContain('useMessageListUi.ts');

    for (const relativePath of sourceFiles) {
      const source = readProjectFile(relativePath);
      expect(source, relativePath).not.toContain('useAppUI');
      expect(source, relativePath).not.toContain('useMessageListUI');
    }
  });

  it('keeps local third-party declarations specific enough to avoid explicit any', () => {
    const turndownGfmDeclaration = readProjectFile('src/types/turndown-plugin-gfm.d.ts');

    expect(turndownGfmDeclaration).toContain('TurndownService');
    expect(turndownGfmDeclaration).not.toMatch(/\bany\b/);
  });

  it('keeps migrated pure helper modules in utils without hooks compatibility wrappers', () => {
    const migratedHelperModules = [
      ['src/hooks/chat-input/chatInputAvailability.ts', 'src/utils/chat-input/chatInputAvailability.ts'],
      ['src/hooks/chat-input/chatInputStateMachine.ts', 'src/utils/chat-input/chatInputStateMachine.ts'],
      ['src/hooks/chat-input/chatInputUtils.ts', 'src/utils/chat-input/chatInputUtils.ts'],
      ['src/hooks/chat-input/pendingSubmissionUtils.ts', 'src/utils/chat-input/pendingSubmissionUtils.ts'],
      ['src/hooks/chat-input/textFileToInput.ts', 'src/utils/chat-input/textFileToInput.ts'],
      ['src/hooks/file-upload/fileUploadPolicy.ts', 'src/utils/file-upload/fileUploadPolicy.ts'],
      ['src/hooks/file-upload/uploadFileItem.ts', 'src/utils/file-upload/uploadFileItem.ts'],
      ['src/hooks/file-upload/uploadQueue.ts', 'src/utils/file-upload/uploadQueue.ts'],
      ['src/hooks/live-api/liveClientFunctions.ts', 'src/utils/live-api/liveClientFunctions.ts'],
      ['src/hooks/live-api/liveErrorState.ts', 'src/utils/live-api/liveErrorState.ts'],
      ['src/hooks/text-selection/liveArtifactSelection.ts', 'src/utils/text-selection/liveArtifactSelection.ts'],
      ['src/hooks/text-selection/selectionClipboard.ts', 'src/utils/text-selection/selectionClipboard.ts'],
    ];
    const sourceFiles = listProjectSourceFiles('src').filter(
      (relativePath) => relativePath !== 'src/test/architecture/projectStructureBoundaries.test.ts',
    );

    const colocatedTestModules = new Set([
      'src/utils/chat-input/chatInputStateMachine.ts',
      'src/utils/chat-input/chatInputUtils.ts',
      'src/utils/chat-input/pendingSubmissionUtils.ts',
      'src/utils/chat-input/textFileToInput.ts',
      'src/utils/file-upload/fileUploadPolicy.ts',
      'src/utils/file-upload/uploadFileItem.ts',
      'src/utils/file-upload/uploadQueue.ts',
      'src/utils/live-api/liveClientFunctions.ts',
      'src/utils/live-api/liveErrorState.ts',
    ]);

    for (const [legacyPath, utilityPath] of migratedHelperModules) {
      expect(fs.existsSync(path.join(projectRoot, legacyPath)), legacyPath).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, utilityPath)), utilityPath).toBe(true);
      if (colocatedTestModules.has(utilityPath)) {
        expect(fs.existsSync(path.join(projectRoot, legacyPath.replace(/\.ts$/, '.test.ts'))), legacyPath).toBe(false);
        expect(fs.existsSync(path.join(projectRoot, utilityPath.replace(/\.ts$/, '.test.ts'))), utilityPath).toBe(true);
      }
    }

    for (const relativePath of sourceFiles) {
      const source = readProjectFile(relativePath);
      for (const [legacyPath] of migratedHelperModules) {
        const legacyImportPath = `@/${legacyPath.replace(/^src\//, '').replace(/\.ts$/, '')}`;
        expect(source, `${relativePath}:${legacyImportPath}`).not.toContain(legacyImportPath);
      }
    }
  });
});
