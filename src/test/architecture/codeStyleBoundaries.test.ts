import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { listProjectSourceFiles, listProjectSourceFilesExcept, projectRoot, readProjectFile } from './projectFiles';

const thisTestFile = 'src/test/architecture/codeStyleBoundaries.test.ts';

const importDeclarationPattern = /^import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"];$/gm;
const sourceImportSpecifierPattern =
  /\b(?:import|export)\b[\s\S]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|vi\.(?:mock|doMock|unmock|importActual|importMock)\s*(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g;

describe('code style boundaries', () => {
  it('keeps lint coverage on TypeScript and local JavaScript tooling', () => {
    const packageJson = readProjectFile('package.json');
    const eslintConfig = readProjectFile('eslint.config.js');

    expect(packageJson).toContain('eslint . --ext .ts,.tsx,.js,.mjs --max-warnings=0');
    expect(eslintConfig).toContain("files: ['**/*.{js,mjs}']");
    expect(eslintConfig).toContain('@typescript-eslint/consistent-type-imports');
    expect(eslintConfig).toContain("files: ['src/test/**/*.{ts,tsx}']");
    expect(eslintConfig).toContain("'react-refresh/only-export-components': 'off'");
  });

  it('keeps local development pinned to the Node major used by CI and Docker', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { engines?: Record<string, string> };
    const npmrc = readProjectFile('.npmrc');
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');
    const contributing = readProjectFile('CONTRIBUTING.md');

    expect(packageJson.engines?.node).toBe('>=26 <27');
    expect(npmrc).toContain('engine-strict=true');
    expect(zhReadme).toContain('Node.js 26');
    expect(enReadme).toContain('Node.js 26');
    expect(contributing).toContain('nvm use');
    expect(contributing).toContain('Node.js 26');
  });

  it('keeps source imports on the app alias when crossing directories', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('/test/architecture/'))
      .filter((relativePath) => {
        const source = readProjectFile(relativePath);
        const sourceDir = path.dirname(path.join(projectRoot, relativePath));
        return Array.from(source.matchAll(sourceImportSpecifierPattern)).some((match) => {
          const specifier = match[1] ?? match[2] ?? match[3];
          const normalizedSpecifier = specifier?.replace(/^(?:\.\/)+/, '');
          if (!normalizedSpecifier?.startsWith('../')) return false;

          const absoluteTarget = path.resolve(sourceDir, specifier);
          return absoluteTarget.startsWith(path.join(projectRoot, 'src') + path.sep);
        });
      });

    expect(offenders).toEqual([]);
  });

  it('keeps same-directory source imports relative instead of using the app alias', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('/test/architecture/'))
      .flatMap((relativePath) => {
        const source = readProjectFile(relativePath);
        const sourceDir = path.dirname(path.join(projectRoot, relativePath));

        return Array.from(source.matchAll(sourceImportSpecifierPattern))
          .map((match) => match[1] ?? match[2] ?? match[3])
          .filter((specifier): specifier is string => Boolean(specifier?.startsWith('@/')))
          .filter((specifier) => {
            const aliasTarget = path.join(projectRoot, specifier.replace('@/', 'src/'));
            const candidateTargets = [
              `${aliasTarget}.ts`,
              `${aliasTarget}.tsx`,
              path.join(aliasTarget, 'index.ts'),
              path.join(aliasTarget, 'index.tsx'),
            ];
            return candidateTargets.some(
              (candidateTarget) => path.dirname(candidateTarget) === sourceDir && fs.existsSync(candidateTarget),
            );
          })
          .map((specifier) => `${relativePath}:${specifier}`);
      });

    expect(offenders).toEqual([]);
  });

  it('keeps ESLint exception paths aligned with files that still exist', () => {
    const eslintConfig = readProjectFile('eslint.config.js');

    expect(fs.existsSync(path.join(projectRoot, 'src/components/icons/CustomIcons.tsx'))).toBe(false);
    expect(eslintConfig).not.toContain('src/components/icons/CustomIcons.tsx');
  });

  it('keeps the src/test ESLint override focused on test-only module exports', () => {
    const eslintConfig = readProjectFile('eslint.config.js');
    const srcTestOverrideMatch = eslintConfig.match(
      /files: \['src\/test\/\*\*\/\*\.\{ts,tsx\}'\],[\s\S]*?rules: \{([\s\S]*?)\n\s*\},\n\s*\},/,
    );

    expect(srcTestOverrideMatch?.[1]).toContain("'react-refresh/only-export-components': 'off'");
    for (const ruleName of ['react-hooks/immutability', 'react-hooks/purity', 'react-hooks/refs']) {
      expect(srcTestOverrideMatch?.[1]).not.toContain(ruleName);
    }
  });

  it('does not repeat static import declarations from the same module', () => {
    const offenders = listProjectSourceFilesExcept('src', thisTestFile).flatMap((relativePath) => {
      const source = readProjectFile(relativePath);
      const importCounts = new Map<string, number>();

      for (const match of source.matchAll(importDeclarationPattern)) {
        const specifier = match[1];
        importCounts.set(specifier, (importCounts.get(specifier) ?? 0) + 1);
      }

      return Array.from(importCounts)
        .filter(([, count]) => count > 1)
        .map(([specifier]) => `${relativePath}:${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps static import declarations before exports', () => {
    const offenders = listProjectSourceFilesExcept('src', thisTestFile).flatMap((relativePath) => {
      const lines = readProjectFile(relativePath).split('\n');
      let sawExport = false;
      const lateImports: string[] = [];

      lines.forEach((line, index) => {
        if (/^export\s/.test(line)) sawExport = true;
        if (sawExport && /^import\s/.test(line)) {
          lateImports.push(`${relativePath}:${index + 1}`);
        }
      });

      return lateImports;
    });

    expect(offenders).toEqual([]);
  });

  it('uses direct React ref type imports instead of namespace ref aliases', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== thisTestFile)
      .filter((relativePath) => /React\.(?:MutableRefObject|RefObject)\b/.test(readProjectFile(relativePath)));

    expect(offenders).toEqual([]);
  });

  it('keeps production code free of double type assertions', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => !relativePath.startsWith('src/test/'))
      .filter((relativePath) => readProjectFile(relativePath).includes('as unknown as'));

    expect(offenders).toEqual([]);
  });

  it('does not call useI18n more than once in a production component or hook', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== thisTestFile)
      .filter((relativePath) => (readProjectFile(relativePath).match(/\buseI18n\(/g) ?? []).length > 1);

    expect(offenders).toEqual([]);
  });

  it('documents a cleanup script for local build and test artifacts', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> };
    const prettierIgnore = readProjectFile('.prettierignore');

    expect(packageJson.scripts?.clean).toBe(
      'rm -rf dist server/dist coverage playwright-report test-results tmp-live-artifact-demo .playwright-visible-demo-profile .codex-dev-*',
    );

    for (const ignoredPath of [
      '.worktrees/',
      'playwright-report/',
      'test-results/',
      '.playwright-visible-demo-profile/',
      'tmp-live-artifact-demo/',
      'server/dist/',
      '.codex-dev-*',
    ]) {
      expect(prettierIgnore).toContain(ignoredPath);
    }
  });

  it('keeps local script filenames on kebab-case command names', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.test).toBe('node scripts/run-vitest.mjs run');
    expect(packageJson.scripts?.['test:watch']).toBe('node scripts/run-vitest.mjs');
    expect(packageJson.scripts?.['build:docker']).toBe('npm run build && npm run build:api');
    expect(packageJson.scripts?.['start:api']).toBe('node server/dist/server/src/index.js');
    expect(fs.existsSync(path.join(projectRoot, 'scripts/runVitest.mjs'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'scripts/run-vitest.mjs'))).toBe(true);
  });

  it('uses the shared ThinkingLevel type instead of repeating the literal union in source files', () => {
    const thinkingLevelUnionPattern =
      /'MINIMAL'\s*\|\s*'LOW'\s*\|\s*'MEDIUM'\s*\|\s*'HIGH'|'LOW'\s*\|\s*'HIGH'\s*\|\s*'MINIMAL'\s*\|\s*'MEDIUM'/;
    const allowedFiles = new Set(['src/types/settings.ts', 'src/test/architecture/codeStyleBoundaries.test.ts']);
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !allowedFiles.has(relativePath))
      .filter((relativePath) => thinkingLevelUnionPattern.test(readProjectFile(relativePath)));

    expect(offenders).toEqual([]);
  });

  it('keeps Vite configuration focused on assembly instead of local API internals', () => {
    const viteConfig = readProjectFile('vite.config.ts');

    expect(viteConfig).toContain("from './vite/localApiPlugin'");
    expect(viteConfig).toContain("from './vite/chunks'");
    expect(viteConfig).not.toContain('const IMAGE_PROXY_PATH');
    expect(viteConfig).not.toContain('configurePreviewServer(server)');
  });

  it('keeps generated worker code out of hook orchestration files', () => {
    const keepAliveHook = readProjectFile('src/hooks/core/useBackgroundKeepAlive.ts');
    const pyodideService = readProjectFile('src/features/local-python/pyodideService.ts');
    const pyodideWorkerTemplate = readProjectFile('src/features/local-python/pyodideWorkerTemplate.ts');

    expect(keepAliveHook).toContain("new URL('./backgroundKeepAliveWorker.ts', import.meta.url)");
    expect(keepAliveHook).not.toContain('const WORKER_CODE');
    expect(keepAliveHook).not.toContain('new Blob([WORKER_CODE]');

    expect(pyodideService).toContain("from './pyodideWorkerTemplate'");
    expect(pyodideService).not.toContain('self.onmessage = async');
    expect(pyodideWorkerTemplate).toContain('__PYODIDE_BASE_URL__');
    expect(pyodideWorkerTemplate).toContain('self.onmessage = async');
  });

  it('names Live API reconnection constants at the module boundary', () => {
    const liveConnectionSource = readProjectFile('src/hooks/live-api/useLiveConnection.ts');

    expect(liveConnectionSource).toContain('const MAX_RECONNECT_RETRIES = 5;');
    expect(liveConnectionSource).toContain('const RECONNECT_BASE_DELAY_MS = 1000;');
    expect(liveConnectionSource).not.toContain('const maxRetries = 5;');
    expect(liveConnectionSource).not.toContain('const baseDelay = 1000;');
  });

  it('does not keep tautological ternaries in production sources', () => {
    const tautologicalLiteralTernaryPattern = /\?\s*(['"`][^'"`]+['"`])\s*:\s*\1/;
    const tautologicalExtensionFallbackPattern = /CREATE_FILE_EXTENSION_OPTIONS\.includes\(ext\)\s*\?\s*ext\s*:\s*ext/;
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== thisTestFile)
      .filter((relativePath) => {
        const source = readProjectFile(relativePath);
        return tautologicalLiteralTernaryPattern.test(source) || tautologicalExtensionFallbackPattern.test(source);
      });

    expect(offenders).toEqual([]);
  });

  it('does not repeat file paths in source header comments', () => {
    const pathHeaderCommentPattern =
      /^\/\/\s*(?:src\/|hooks\/|components\/|utils\/|services\/|features\/).+\.(?:ts|tsx)$/;
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== thisTestFile)
      .filter((relativePath) => pathHeaderCommentPattern.test(readProjectFile(relativePath).split('\n')[0] ?? ''));

    expect(offenders).toEqual([]);
  });

  it('avoids trivial identity aliases in hot UI paths', () => {
    const headerModelSelectorSource = readProjectFile('src/components/header/HeaderModelSelector.tsx');
    const chatInputKeyboardSource = readProjectFile('src/hooks/chat-input/useChatInputKeyboard.ts');
    const useChatSource = readProjectFile('src/hooks/chat/useChat.ts');
    const selectedFileDisplaySource = readProjectFile('src/components/chat/input/SelectedFileDisplay.tsx');
    const liveConnectionSource = readProjectFile('src/hooks/live-api/useLiveConnection.ts');
    const autoTitlingSource = readProjectFile('src/hooks/chat/useAutoTitling.ts');
    const appPromptModesSource = readProjectFile('src/hooks/app/useAppPromptModes.ts');
    const groundingSourcesSource = readProjectFile('src/components/message/grounded-response/groundingSources.ts');
    const useCodeBlockSource = readProjectFile('src/hooks/ui/useCodeBlock.ts');

    expect(headerModelSelectorSource).not.toContain('const displayModelName = currentModelName;');
    expect(chatInputKeyboardSource).not.toContain('const rawInput = inputText;');
    expect(useChatSource).not.toContain('const messages = activeMessages;');
    expect(useChatSource).not.toContain('const effectiveApiModels = apiModelsFromHook;');
    expect(selectedFileDisplaySource).not.toContain('const hasOverflowActions = canCopyFileId;');
    expect(liveConnectionSource).not.toContain('const connectedRef = isConnectedRef;');
    expect(liveConnectionSource).not.toContain('const reconnectingRef = isReconnectingRef;');
    expect(liveConnectionSource).not.toContain('const connectingRef = isConnectingRef;');
    expect(autoTitlingSource).not.toContain('const session = activeChat;');
    expect(appPromptModesSource).not.toContain('const pendingActivation = pendingLiveArtifactsPromptActivation;');
    expect(groundingSourcesSource).not.toContain('const rawText = text;');
    expect(useCodeBlockSource).not.toContain('const resolvedCodeText = currentContent;');
  });

  it('uses object property shorthand for direct same-name assignments', () => {
    const redundantPropertyAssignmentPattern = /\b([A-Za-z_$][\w$]*)\s*:\s*\1(?=\s*[,}])/;
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== 'src/test/architecture/codeStyleBoundaries.test.ts')
      .filter((relativePath) =>
        readProjectFile(relativePath)
          .split('\n')
          .some((line) => !line.includes('?') && redundantPropertyAssignmentPattern.test(line)),
      );

    expect(offenders).toEqual([]);
  });

  it('uses descriptive callback parameter names in file collection updates', () => {
    const fileCollectionSources = [
      'src/utils/file-upload/uploadFileItem.ts',
      'src/hooks/file-upload/useFilePolling.ts',
      'src/hooks/file-upload/useFileIdAdder.ts',
      'src/hooks/file-upload/useFilePreProcessing.ts',
      'src/hooks/chat/useChat.ts',
      'src/features/message-sender/useMessageSender.ts',
      'src/hooks/chat/actions/useAudioActions.ts',
      'src/hooks/token-count/useTokenCountLogic.ts',
      'src/components/message/buttons/export/useMessageExport.ts',
      'src/hooks/data-management/useChatSessionExport.ts',
      'src/utils/export/templates.ts',
      'src/components/message/content/MessageFiles.tsx',
      'src/components/message/blocks/CodeBlock.tsx',
      'src/components/message/blocks/ToolResultBlock.tsx',
    ];
    const terseFileCallbackPattern = /\.(?:map|filter|find|some|every|forEach)\(\(?f\b/;
    const offenders = fileCollectionSources.filter((relativePath) =>
      readProjectFile(relativePath)
        .split('\n')
        .some((line) => terseFileCallbackPattern.test(line)),
    );

    expect(offenders).toEqual([]);
  });

  it('uses descriptive callback parameter names in scenario collection updates', () => {
    const scenarioCollectionSources = [
      'src/hooks/scenarios/useScenarioManager.ts',
      'src/components/scenarios/ScenarioEditor.tsx',
      'src/components/scenarios/ScenarioList.tsx',
      'src/components/scenarios/editor/ScenarioMessageList.tsx',
    ];
    const terseScenarioCallbackPattern = /\.(?:map|filter|find|some)\(\(?[ms]\b/;
    const offenders = scenarioCollectionSources.filter((relativePath) =>
      readProjectFile(relativePath)
        .split('\n')
        .some((line) => terseScenarioCallbackPattern.test(line)),
    );

    expect(offenders).toEqual([]);
  });

  it('exports ordinary type modules through the central types barrel', () => {
    const typeFiles = fs
      .readdirSync(path.join(projectRoot, 'src/types'))
      .filter((fileName) => fileName.endsWith('.ts'))
      .filter((fileName) => fileName !== 'index.ts')
      .filter((fileName) => !fileName.endsWith('.d.ts'))
      .map((fileName) => path.basename(fileName, '.ts'))
      .sort();
    const typesIndex = readProjectFile('src/types/index.ts');
    const exportedModules = Array.from(typesIndex.matchAll(/export \* from '\.\/([^']+)';/g))
      .map((match) => match[1])
      .sort();

    expect(exportedModules).toEqual(typeFiles);
  });

  it('routes browser runtime diagnostics through logService instead of direct console calls', () => {
    const allowedConsoleFiles = new Set([
      'src/services/logService.ts',
      'src/services/db/indexedDbAccess.ts',
      'src/features/local-python/pyodideWorkerTemplate.ts',
      'src/utils/chat/session.ts',
      'src/utils/html-preview/previewBridgeScript.ts',
    ]);

    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => !allowedConsoleFiles.has(relativePath))
      .filter((relativePath) => /\bconsole\.(?:debug|error|info|log|warn)\b/.test(readProjectFile(relativePath)));

    expect(offenders).toEqual([]);
  });

  it('keeps chat input visibility flags explicitly boolean', () => {
    const toolbarSource = readProjectFile('src/components/chat/input/ChatInputToolbar.tsx');

    expect(toolbarSource).toContain('const canShowTtsVoice =');
    expect(toolbarSource).toContain('const canShowMediaResolution =');
    expect(toolbarSource).toContain('Boolean(ttsVoice)');
    expect(toolbarSource).toContain('Boolean(mediaResolution)');
    expect(toolbarSource).not.toMatch(/const showTtsVoice\s*=\s*[^;]*&&\s*ttsVoice\s*&&/);
    expect(toolbarSource).not.toMatch(/const showMediaResolution\s*=\s*[^;]*&&\s*mediaResolution\s*&&/);
  });

  it('keeps hook lint escapes narrow and explained', () => {
    const selectionDragSource = readProjectFile('src/hooks/text-selection/useSelectionDrag.ts');
    const sourceFiles = listProjectSourceFilesExcept('src', thisTestFile);
    const sourceLevelRefDisables = sourceFiles.filter((relativePath) =>
      readProjectFile(relativePath).includes('eslint-disable react-hooks/refs'),
    );
    const unexplainedSetStateEffectDisables = sourceFiles.filter((relativePath) =>
      readProjectFile(relativePath)
        .split('\n')
        .some(
          (line) => line.includes('eslint-disable-next-line react-hooks/set-state-in-effect') && !line.includes('--'),
        ),
    );
    const unexplainedExhaustiveDepsDisables = sourceFiles.filter((relativePath) =>
      readProjectFile(relativePath)
        .split('\n')
        .some(
          (line) =>
            (line.includes('eslint-disable-line react-hooks/exhaustive-deps') ||
              line.includes('eslint-disable-next-line react-hooks/exhaustive-deps')) &&
            !line.includes('--'),
        ),
    );

    expect(selectionDragSource).not.toMatch(
      /^\/\* eslint-disable react-hooks\/immutability, react-hooks\/exhaustive-deps \*\//,
    );
    expect(selectionDragSource).not.toContain('eslint-disable react-hooks/exhaustive-deps');
    expect(selectionDragSource).not.toContain('eslint-disable-next-line react-hooks/immutability');
    expect(sourceLevelRefDisables).toEqual([]);
    expect(unexplainedSetStateEffectDisables).toEqual([]);
    expect(unexplainedExhaustiveDepsDisables).toEqual([]);
    expect(readProjectFile('src/hooks/live-api/useLiveConnection.ts')).not.toContain(
      'eslint-disable-next-line react-hooks/exhaustive-deps',
    );
  });

  it('keeps React Refresh component-export exceptions in ESLint config instead of source comments', () => {
    const sourceFiles = listProjectSourceFilesExcept('src', thisTestFile);
    const sourceLevelReactRefreshDisables = sourceFiles.filter((relativePath) =>
      readProjectFile(relativePath).includes('eslint-disable react-refresh/only-export-components'),
    );
    const eslintConfig = readProjectFile('eslint.config.js');

    expect(sourceLevelReactRefreshDisables).toEqual([]);
    expect(eslintConfig).toContain("'react-refresh/only-export-components': 'off'");
  });
});
