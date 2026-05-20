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

describe('refactor boundary guardrails', () => {
  it('keeps constants imports tied to focused constant modules', () => {
    const appConstantsSource = readProjectFile('src/constants/appConstants.ts');

    for (const reExport of [
      "export * from './modelConstants';",
      "export * from './shortcuts';",
      "export * from './storageKeys';",
      "export * from './styleClasses';",
    ]) {
      expect(appConstantsSource).not.toContain(reExport);
    }

    expect(fs.existsSync(path.join(projectRoot, 'src/constants/modelConstants.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/storageKeys.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/styleClasses.ts'))).toBe(true);
  });

  it('imports shared settings types through the central types barrel', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => relativePath !== 'src/test/architecture/refactorBoundaries.test.ts')
      .filter((relativePath) => readProjectFile(relativePath).includes("from '@/types/settings'"));

    expect(offenders).toEqual([]);
  });

  it('routes completion feedback through focused helpers', () => {
    const messagePipelineSource = readProjectFile('src/features/message-sender/messagePipeline.ts');
    const chatStreamHandlerSource = readProjectFile('src/features/message-sender/useChatStreamHandler.ts');
    const assetsSource = readProjectFile('src/constants/assets.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/completionFeedback.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/features/message-sender/completionFeedback.ts'))).toBe(true);
    expect(messagePipelineSource).toContain("from './completionFeedback'");
    expect(chatStreamHandlerSource).toContain("from './completionFeedback'");
    expect(chatStreamHandlerSource).not.toContain('showNotification');
    expect(chatStreamHandlerSource).not.toContain('playCompletionSound');
    expect(assetsSource).toContain('APP_NOTIFICATION_ICON_URL');
    expect(assetsSource).not.toContain('data:image/svg+xml;base64');
  });

  it('keeps server route handlers out of the createServer assembly file', () => {
    const createServerSource = readProjectFile('server/src/createServer.ts');

    for (const relativePath of [
      'server/src/clipboardImage.ts',
      'server/src/cors.ts',
      'server/src/geminiProxy.ts',
      'server/src/imageProxy.ts',
    ]) {
      expect(fs.existsSync(path.join(projectRoot, relativePath))).toBe(true);
    }

    expect(createServerSource).toContain("from './clipboardImage.js'");
    expect(createServerSource).toContain("from './geminiProxy.js'");
    expect(createServerSource).toContain("from './imageProxy.js'");
    expect(createServerSource).not.toContain('MACOS_CLIPBOARD_PNG_SCRIPT');
    expect(createServerSource).not.toContain('STRIPPED_PROXY_REQUEST_HEADERS');
    expect(createServerSource).not.toContain('parseAllowedImageProxyUrl');
  });
});
