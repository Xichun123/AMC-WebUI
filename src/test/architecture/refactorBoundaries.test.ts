import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { listProjectSourceFiles, projectRoot, readProjectFile } from './projectFiles';

describe('refactor boundary guardrails', () => {
  it('keeps constants imports tied to focused constant modules', () => {
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/appConstants.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/styleClasses.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/settingsDefaults.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/buttonClasses.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/focusClasses.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/menuClasses.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/formClasses.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/fileTypeSupport.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/modelConfiguration.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/themeRegistry.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/fileConstants.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/modelConstants.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/themeConstants.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/storageKeys.ts'))).toBe(true);
  });

  it('imports shared settings types through the central types barrel', () => {
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => relativePath !== 'src/test/architecture/refactorBoundaries.test.ts')
      .filter((relativePath) => readProjectFile(relativePath).includes("from '@/types/settings'"));

    expect(offenders).toEqual([]);
  });

  it('routes completion feedback through focused business and browser helpers', () => {
    const messagePipelineSource = readProjectFile('src/features/message-sender/messagePipeline.ts');
    const chatStreamHandlerSource = readProjectFile('src/features/message-sender/useChatStreamHandler.ts');
    const messageSenderFeedbackSource = readProjectFile('src/features/message-sender/completionFeedback.ts');
    const assetsSource = readProjectFile('src/constants/assets.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/browserCompletionFeedback.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/utils/completionFeedback.ts'))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, 'src/features/message-sender/completionFeedback.ts'))).toBe(true);
    expect(messagePipelineSource).toContain("from './completionFeedback'");
    expect(chatStreamHandlerSource).toContain("from './completionFeedback'");
    expect(messageSenderFeedbackSource).toContain("from '@/utils/browserCompletionFeedback'");
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
