import type { HttpOptions, Part } from '@google/genai';

export type GeminiClientHttpOptions = Pick<HttpOptions, 'apiVersion' | 'baseUrl' | 'headers' | 'timeout'>;

const MEDIA_RESOLUTION_API_VERSION = 'v1alpha';

const hasPerPartMediaResolution = (parts: Part[] = []): boolean =>
  parts.some((part) => Boolean((part as Part & { mediaResolution?: unknown }).mediaResolution));

export const getHttpOptionsForContents = (contents: Array<{ parts?: Part[] }>): GeminiClientHttpOptions | undefined => {
  if (contents.some((content) => hasPerPartMediaResolution(content.parts))) {
    return { apiVersion: MEDIA_RESOLUTION_API_VERSION };
  }

  return undefined;
};
