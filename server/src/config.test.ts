import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('defaults backendFlavor to aistudio when GEMINI_BACKEND is unset', () => {
    const config = loadConfig({});
    expect(config.backendFlavor).toBe('aistudio');
    expect(config.vertex).toBeUndefined();
  });

  it('keeps backendFlavor aistudio for unrecognized GEMINI_BACKEND values', () => {
    expect(loadConfig({ GEMINI_BACKEND: 'studio' }).backendFlavor).toBe('aistudio');
    expect(loadConfig({ GEMINI_BACKEND: '' }).backendFlavor).toBe('aistudio');
  });

  it('parses GEMINI_BACKEND=vertex case-insensitively', () => {
    expect(loadConfig({ GEMINI_BACKEND: 'VERTEX', GCP_PROJECT_ID: 'p' }).backendFlavor).toBe('vertex');
  });

  it('requires GCP_PROJECT_ID when backend is vertex', () => {
    expect(() => loadConfig({ GEMINI_BACKEND: 'vertex' })).toThrow(/GCP_PROJECT_ID is required/);
  });

  it('reads vertex config including a custom location', () => {
    const config = loadConfig({
      GEMINI_BACKEND: 'vertex',
      GCP_PROJECT_ID: 'my-proj',
      GCP_LOCATION: 'europe-west4',
    });
    expect(config.vertex).toEqual({ projectId: 'my-proj', location: 'europe-west4' });
  });

  it('falls back to us-central1 when GCP_LOCATION is empty', () => {
    const config = loadConfig({ GEMINI_BACKEND: 'vertex', GCP_PROJECT_ID: 'my-proj' });
    expect(config.vertex?.location).toBe('us-central1');
  });
});
