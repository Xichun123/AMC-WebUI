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

  it('omits gcs config when GCS_BUCKET is unset in vertex mode', () => {
    const config = loadConfig({ GEMINI_BACKEND: 'vertex', GCP_PROJECT_ID: 'p' });
    expect(config.gcs).toBeUndefined();
  });

  it('reads gcs config with defaults when GCS_BUCKET is set', () => {
    const config = loadConfig({ GEMINI_BACKEND: 'vertex', GCP_PROJECT_ID: 'p', GCS_BUCKET: 'my-bucket' });
    expect(config.gcs).toEqual({
      bucketName: 'my-bucket',
      objectPrefix: 'amc-files/',
      maxFileBytes: 100 * 1024 * 1024,
    });
  });

  it('normalizes GCS_OBJECT_PREFIX by stripping leading slash and ensuring trailing slash', () => {
    const config = loadConfig({
      GEMINI_BACKEND: 'vertex',
      GCP_PROJECT_ID: 'p',
      GCS_BUCKET: 'b',
      GCS_OBJECT_PREFIX: '/tenant/files',
    });
    expect(config.gcs?.objectPrefix).toBe('tenant/files/');
  });

  it('parses GCS_MAX_FILE_BYTES as integer', () => {
    const config = loadConfig({
      GEMINI_BACKEND: 'vertex',
      GCP_PROJECT_ID: 'p',
      GCS_BUCKET: 'b',
      GCS_MAX_FILE_BYTES: '524288',
    });
    expect(config.gcs?.maxFileBytes).toBe(524288);
  });

  it('falls back to default GCS_MAX_FILE_BYTES on invalid input', () => {
    const config = loadConfig({
      GEMINI_BACKEND: 'vertex',
      GCP_PROJECT_ID: 'p',
      GCS_BUCKET: 'b',
      GCS_MAX_FILE_BYTES: 'not-a-number',
    });
    expect(config.gcs?.maxFileBytes).toBe(100 * 1024 * 1024);
  });

  it('ignores GCS_BUCKET in aistudio mode', () => {
    const config = loadConfig({ GCS_BUCKET: 'should-be-ignored' });
    expect(config.gcs).toBeUndefined();
  });
});
