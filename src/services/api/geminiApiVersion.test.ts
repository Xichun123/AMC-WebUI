import { describe, expect, it } from 'vitest';
import { PartMediaResolutionLevel } from '@google/genai';
import { getHttpOptionsForContents } from './geminiApiVersion';

describe('geminiApiVersion', () => {
  it('selects v1alpha when any content part carries per-part media resolution', () => {
    expect(
      getHttpOptionsForContents([
        { parts: [{ text: 'hello' }] },
        {
          parts: [
            {
              inlineData: { mimeType: 'image/png', data: 'abc' },
              mediaResolution: { level: PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH },
            },
          ],
        },
      ]),
    ).toEqual({ apiVersion: 'v1alpha' });
  });

  it('leaves default SDK API version unchanged when no per-part media resolution is present', () => {
    expect(getHttpOptionsForContents([{ parts: [{ text: 'hello' }] }])).toBeUndefined();
  });
});
