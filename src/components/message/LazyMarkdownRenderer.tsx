import React, { Suspense } from 'react';
import type { MarkdownRendererProps } from './BaseMarkdownRenderer';
import { lazyNamedComponent } from '@/utils/lazyNamedComponent';
import { containsTexMathMarkdown } from '@/utils/markdownMathConfig';

const LazyBasicMarkdownRenderer = lazyNamedComponent(() => import('./BasicMarkdownRenderer'), 'BasicMarkdownRenderer');
const LazyMathMarkdownRenderer = lazyNamedComponent(() => import('./MathMarkdownRenderer'), 'MathMarkdownRenderer');

interface LazyMarkdownRendererProps extends MarkdownRendererProps {
  fallbackMode?: 'raw' | 'none';
}

export const LazyMarkdownRenderer: React.FC<LazyMarkdownRendererProps> = ({
  content,
  fallbackMode = 'raw',
  ...props
}) => {
  const shouldLoadMathRenderer = containsTexMathMarkdown(content);
  const fallback =
    fallbackMode === 'raw' ? (
      <div className="whitespace-pre-wrap break-words text-[var(--theme-text-secondary)]">{content}</div>
    ) : null;

  if (!shouldLoadMathRenderer) {
    return (
      <Suspense fallback={fallback}>
        <LazyBasicMarkdownRenderer {...props} content={content} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <LazyMathMarkdownRenderer content={content} {...props} />
    </Suspense>
  );
};
