import { act, type ComponentProps } from 'react';
import { vi } from 'vitest';
import { BasicMarkdownRenderer } from '@/components/message/BasicMarkdownRenderer';
import type { TestRenderer } from '@/test/render/renderer';

export type BasicMarkdownRendererTestProps = Partial<ComponentProps<typeof BasicMarkdownRenderer>> & {
  content: string;
};

export const createBasicMarkdownRendererElement = (props: BasicMarkdownRendererTestProps) => (
  <BasicMarkdownRenderer
    isLoading={false}
    onImageClick={vi.fn()}
    onOpenHtmlPreview={vi.fn()}
    expandCodeBlocksByDefault={false}
    isMermaidRenderingEnabled={false}
    isGraphvizRenderingEnabled={false}
    themeId="pearl"
    onOpenSidePanel={vi.fn()}
    {...props}
  />
);

export const renderBasicMarkdown = (renderer: TestRenderer, props: BasicMarkdownRendererTestProps) => {
  act(() => {
    renderer.render(createBasicMarkdownRendererElement(props));
  });
};
