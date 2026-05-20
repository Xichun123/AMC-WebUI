import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../..');
const thisTestFile = 'src/test/architecture/testInfrastructure.test.ts';

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

describe('test infrastructure guardrails', () => {
  it('keeps targeted Vitest script filters pointed at existing test files', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> };
    const codeExecutionScript = packageJson.scripts?.['test:code-execution'] ?? '';
    const targetedTestFiles = codeExecutionScript
      .split(/\s+/)
      .filter((token) => /^src\/.*\.test\.(ts|tsx)$/.test(token));

    expect(targetedTestFiles).toContain('src/utils/file-upload/fileUploadPolicy.test.ts');

    for (const relativePath of targetedTestFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }
  });

  it('keeps React act environment configuration centralized in test setup', () => {
    const testFiles = listProjectSourceFiles('src').filter(
      (relativePath) => /\.(test|spec)\.(ts|tsx)$/.test(relativePath) && relativePath !== thisTestFile,
    );

    for (const relativePath of testFiles) {
      const source = readProjectFile(relativePath);

      expect(source, relativePath).not.toContain('IS_REACT_ACT_ENVIRONMENT');
    }

    expect(readProjectFile('src/test/setup.ts')).toContain('IS_REACT_ACT_ENVIRONMENT');
  });

  it('keeps shared test renderer cleanup out of individual test suites', () => {
    const explicitRendererLifecycleFiles = new Set([
      'src/components/modals/CreateTextFileEditor.preferences.test.tsx',
      'src/components/message/blocks/lazy-diagram-loading.test.tsx',
      'src/components/shared/file-preview/MarkdownFileViewer.test.tsx',
    ]);
    for (const relativePath of explicitRendererLifecycleFiles) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }

    const testFiles = listProjectSourceFiles('src').filter(
      (relativePath) => /\.(test|spec)\.(ts|tsx)$/.test(relativePath) && relativePath !== thisTestFile,
    );

    for (const relativePath of testFiles) {
      const source = readProjectFile(relativePath);

      expect(source, relativePath).not.toMatch(
        /afterEach\(\(\)\s*=>\s*{\s*act\(\(\)\s*=>\s*{\s*root\.unmount\(\);\s*}\);\s*}\);/s,
      );
      expect(source, relativePath).not.toMatch(
        /afterEach\(\(\)\s*=>\s*{\s*act\(\(\)\s*=>\s*{\s*root\.unmount\(\);\s*}\);\s*vi\.(?:clearAllMocks|restoreAllMocks)\(\);\s*}\);/s,
      );

      if (
        !explicitRendererLifecycleFiles.has(relativePath) &&
        relativePath !== 'src/components/layout/ChatArea.test.tsx'
      ) {
        expect(source, relativePath).not.toMatch(
          /afterEach\(\(\)\s*=>\s*{[\s\S]*?\b(?:root\??|mounted\.root)\.unmount\(\)/,
        );
      }
    }
  });

  it('keeps core infrastructure mocks on shared test doubles', () => {
    const testFiles = listProjectSourceFiles('src').filter(
      (relativePath) => /\.(test|spec)\.(ts|tsx)$/.test(relativePath) && relativePath !== thisTestFile,
    );

    for (const relativePath of testFiles) {
      const source = readProjectFile(relativePath);

      expect(source, relativePath).not.toMatch(/\b(?:logService|dbService):\s*{/);
      expect(source, relativePath).not.toMatch(/\buseI18n:\s*\(\)\s*=>/);

      if (!relativePath.startsWith('src/test/')) {
        expect(source, relativePath).not.toMatch(/\bcreate(?:MockLogService|MockDbService|I18nMock|RealI18nMock)\(\)/);
      }
    }
  });

  it('keeps core mock modules behind moduleMockDoubles outside the test-double suites', () => {
    const testFiles = listProjectSourceFiles('src').filter(
      (relativePath) =>
        /\.(test|spec)\.(ts|tsx)$/.test(relativePath) &&
        !relativePath.startsWith('src/test/') &&
        relativePath !== thisTestFile,
    );

    for (const relativePath of testFiles) {
      const source = readProjectFile(relativePath);

      expect(source, relativePath).not.toContain('serviceTestDoubles');
      expect(source, relativePath).not.toContain('i18nTestDoubles');
    }
  });

  it('keeps complex hook test inputs on typed shared factories', () => {
    const senderSource = readProjectFile('src/features/message-sender/useMessageSender.test.tsx');
    const standardChatSource = readProjectFile('src/features/message-sender/standardChatStrategy.test.tsx');
    const sessionLoaderSource = readProjectFile('src/hooks/chat/history/useSessionLoader.test.tsx');

    expect(senderSource).toContain('createMessageSenderProps');
    expect(senderSource).toContain('createUploadedFile');
    expect(senderSource).not.toContain('useMessageSender({');
    expect(senderSource).not.toContain('as any');

    expect(standardChatSource).toContain('createStandardChatProps');
    expect(standardChatSource).not.toContain('useStandardChat({');
    expect(standardChatSource).not.toContain('as any');

    expect(sessionLoaderSource).toContain('createSessionLoaderProps');
    expect(sessionLoaderSource).not.toContain('useSessionLoader({');
    expect(sessionLoaderSource).not.toContain('as any');
  });
});
