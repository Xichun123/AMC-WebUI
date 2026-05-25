import type { jsPDF } from 'jspdf';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { MarkdownPdfRenderer } from './MarkdownPdfRenderer';
import { CJK_TEXT_PATTERN } from './markdownPdfFonts';
import type { MarkdownNode, MarkdownPdfOptions } from './markdownPdfTypes';

type PdfDocument = InstanceType<typeof jsPDF>;
export type { PdfDocument };

export const createMarkdownPdfBlob = async (markdown: string, options: MarkdownPdfOptions): Promise<Blob> => {
  const processor = unified().use(remarkParse).use(remarkGfm);
  const tree = processor.parse(markdown || '') as MarkdownNode;
  const renderer = new MarkdownPdfRenderer(options.themeId, options.filename, CJK_TEXT_PATTERN.test(markdown));

  return renderer.render(tree);
};
