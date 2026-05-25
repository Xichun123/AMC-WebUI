import { describe, expect, it } from 'vitest';
import { readProjectFile } from './projectFiles';

describe('chat input event contracts', () => {
  it('keeps chat input event handlers on explicit command contracts instead of double-casting events', () => {
    const chatTextAreaSource = readProjectFile('src/components/chat/input/area/ChatTextArea.tsx');
    const keyboardSource = readProjectFile('src/hooks/chat-input/useChatInputKeyboard.ts');
    const contextTypesSource = readProjectFile('src/components/chat/input/chatInputContextTypes.ts');

    expect(chatTextAreaSource).not.toContain('event as unknown as React.ChangeEvent<HTMLTextAreaElement>');
    expect(keyboardSource).not.toContain('event as unknown as React.FormEvent');
    expect(contextTypesSource).toContain('handleSubmit: () => void;');
  });
});
