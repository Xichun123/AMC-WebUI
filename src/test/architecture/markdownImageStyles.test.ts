import { describe, expect, it } from 'vitest';
import { readMarkdownCss } from './projectFiles';

describe('markdown image styling', () => {
  it('caps markdown image height and keeps containment styling', () => {
    const css = readMarkdownCss();

    expect(css).toContain('max-height: 320px;');
    expect(css).toContain('object-fit: contain;');
    expect(css).toContain('background-color: var(--theme-bg-tertiary);');
  });
});
