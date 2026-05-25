import { describe, expect, it } from 'vitest';
import type { Part } from '@google/genai';
import { appendApiPart } from './messageStreamParts';

describe('appendApiPart', () => {
  it('preserves signature-only text parts instead of merging them into the previous text part', () => {
    const parts = appendApiPart([{ text: 'final answer' } as Part], { text: '', thoughtSignature: 'sig-123' } as Part);

    expect(parts).toEqual([{ text: 'final answer' }, { text: '', thoughtSignature: 'sig-123' }]);
  });

  it('still merges plain text chunks without metadata', () => {
    const parts = appendApiPart([{ text: 'hello' } as Part], { text: ' world' } as Part);

    expect(parts).toEqual([{ text: 'hello world' }]);
  });

  it('preserves code execution output inline data exactly for API context replay', () => {
    const parts = appendApiPart([], {
      inlineData: { mimeType: 'image/png', data: 'base64-chart' },
      thoughtSignature: 'sig-image',
    } as Part);

    expect(parts).toEqual([
      {
        inlineData: { mimeType: 'image/png', data: 'base64-chart' },
        thoughtSignature: 'sig-image',
      },
    ]);
  });
});
