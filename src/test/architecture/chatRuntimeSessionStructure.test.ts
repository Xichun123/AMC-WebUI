import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { projectRoot, readProjectFile } from './projectFiles';

describe('chat runtime and session structure boundaries', () => {
  it('keeps chat runtime value assembly outside the context definition file', () => {
    const runtimeContextSource = readProjectFile('src/components/layout/chat-runtime/ChatRuntimeContext.tsx');
    const runtimeValuesSource = readProjectFile('src/components/layout/chat-runtime/chatRuntimeValues.ts');
    const headerRuntimeValuesSource = readProjectFile('src/components/layout/chat-runtime/headerRuntimeValues.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-runtime/chatRuntimeTypes.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-runtime/headerRuntimeValues.ts'))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-runtime/messageListRuntimeValues.ts')),
    ).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/components/layout/chat-runtime/inputRuntimeValues.ts'))).toBe(
      true,
    );
    expect(runtimeContextSource).toContain("from './chatRuntimeValues'");
    expect(runtimeContextSource).toContain("from './chatRuntimeTypes'");
    expect(runtimeContextSource).not.toContain('const buildHeaderModels =');
    expect(runtimeContextSource).not.toContain('const focusChatInputSoon =');
    expect(runtimeContextSource).not.toContain('const useChatRuntimeValues =');
    expect(runtimeValuesSource).toContain('export const useChatRuntimeValues =');
    expect(runtimeValuesSource).toContain("from './headerRuntimeValues'");
    expect(runtimeValuesSource).toContain("from './messageListRuntimeValues'");
    expect(runtimeValuesSource).toContain("from './inputRuntimeValues'");
    expect(runtimeValuesSource).not.toContain('const buildHeaderModels =');
    expect(headerRuntimeValuesSource).toContain('const buildHeaderModels =');
  });

  it('uses one shared chat input focus helper for delayed composer focus', () => {
    const appPromptModesSource = readProjectFile('src/hooks/app/useAppPromptModes.ts');
    const modelSelectionSource = readProjectFile('src/hooks/chat/actions/useModelSelection.ts');
    const sessionDraftsSource = readProjectFile('src/hooks/chat/history/sessionLoaderDrafts.ts');
    const runtimeValuesSource = readProjectFile('src/components/layout/chat-runtime/chatRuntimeValues.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/utils/chat-input/focus.ts'))).toBe(true);
    expect(appPromptModesSource).toContain("from '@/utils/chat-input/focus'");
    expect(modelSelectionSource).toContain("from '@/utils/chat-input/focus'");
    expect(runtimeValuesSource).not.toContain('const focusChatInputSoon =');
    expect(sessionDraftsSource).not.toContain('export const focusChatInput =');
    expect(modelSelectionSource).not.toContain('CHAT_INPUT_TEXTAREA_SELECTOR');
    expect(appPromptModesSource).not.toContain('CHAT_INPUT_TEXTAREA_SELECTOR');
  });

  it('keeps chat session loading helpers named by responsibility', () => {
    const sessionLoaderSource = readProjectFile('src/hooks/chat/history/useSessionLoader.ts');

    expect(fs.existsSync(path.join(projectRoot, 'src/hooks/chat/history/sessionLoaderSettings.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/hooks/chat/history/sessionLoaderDrafts.ts'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/hooks/chat/history/sessionInitialLoad.ts'))).toBe(true);
    expect(sessionLoaderSource).toContain("from './sessionLoaderSettings'");
    expect(sessionLoaderSource).toContain("from './sessionLoaderDrafts'");
    expect(sessionLoaderSource).toContain("from './sessionInitialLoad'");
    expect(sessionLoaderSource).not.toContain('const sortSessionsByPinnedAndTimestamp =');
    expect(sessionLoaderSource).not.toContain('const sanitizeSessionModel =');
    expect(sessionLoaderSource).not.toContain('const toSessionMetadata =');
  });
});
