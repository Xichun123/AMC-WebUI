import { describe, expect, it } from 'vitest';
import { convertHtmlToMarkdown } from './htmlToMarkdown';

describe('convertHtmlToMarkdown', () => {
  it('keeps ordered-number punctuation readable in converted markdown headings', () => {
    const markdown = convertHtmlToMarkdown('<h3>5. 带有双下划线（常用于 Python 特殊方法）</h3>');

    expect(markdown).toBe('### 5. 带有双下划线（常用于 Python 特殊方法）');
  });

  it('keeps ordered-number punctuation escaped in ordinary paragraphs', () => {
    const markdown = convertHtmlToMarkdown('<p>5. 带有双下划线（常用于 Python 特殊方法）</p>');

    expect(markdown).toBe('5\\. 带有双下划线（常用于 Python 特殊方法）');
  });
});
