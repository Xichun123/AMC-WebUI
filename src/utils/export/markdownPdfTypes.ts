export interface MarkdownPdfOptions {
  filename: string;
  themeId: string;
}

export type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  alt?: string;
  ordered?: boolean;
  lang?: string;
  children?: MarkdownNode[];
};
