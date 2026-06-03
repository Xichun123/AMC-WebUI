import { describe, expect, it } from 'vitest';
import { readMarkdownCss } from './projectFiles';

describe('message long text styling', () => {
  it('allows long unbroken message text to wrap inside the bubble', () => {
    const css = readMarkdownCss();

    expect(css).toContain('.message-content-container .markdown-body');
    expect(css).toContain('max-width: 100%;');
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).toContain('word-break: break-word;');
  });
});
