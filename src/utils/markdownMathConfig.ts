import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { PluggableList } from 'unified';

export const mathRemarkPlugins: PluggableList = [remarkMath];

export const getMathRehypePlugins = (): PluggableList => [[rehypeKatex, { throwOnError: false, strict: false }]];

const BLOCK_TEX_MATH_PATTERN = /(^|[^\\])\$\$[\s\S]*?[^\\]\$\$/m;
const INLINE_TEX_MATH_PATTERN = /(^|[^\\])\$(?!\$)(?:\\.|[^\\$\n])+\$/m;

export const containsTexMathMarkdown = (content: string): boolean =>
  BLOCK_TEX_MATH_PATTERN.test(content) || INLINE_TEX_MATH_PATTERN.test(content);
