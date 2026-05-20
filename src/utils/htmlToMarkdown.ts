import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

import { logService } from '@/services/logService';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

turndownService.use(gfm);

turndownService.remove(['script', 'style', 'noscript', 'iframe', 'object', 'video', 'audio']);

turndownService.addRule('katex', {
  filter: (node) => {
    return node.nodeName === 'SPAN' && node.classList.contains('katex');
  },
  replacement: (content, node) => {
    const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
      const latex = annotation.textContent || '';
      const isDisplay = node.classList.contains('katex-display') || node.querySelector('.katex-display') !== null;

      return isDisplay ? `$$ ${latex} $$` : `$${latex}$`;
    }
    return content;
  },
});

const restoreReadableHeadingNumberPunctuation = (markdown: string): string =>
  markdown.replace(/^(#{1,6}\s+\d+)\\\./gm, '$1.');

export const convertHtmlToMarkdown = (html: string): string => {
  try {
    return restoreReadableHeadingNumberPunctuation(turndownService.turndown(html));
  } catch (error) {
    logService.error('Failed to convert HTML to Markdown:', error);
    return '';
  }
};
