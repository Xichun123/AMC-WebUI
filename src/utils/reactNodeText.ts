import { isValidElement, type ReactNode } from 'react';

export const extractTextFromNode = (node: ReactNode): string => {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromNode).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextFromNode(node.props.children);
  }
  return '';
};
