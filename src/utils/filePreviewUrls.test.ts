import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupFilePreviewUrl, cleanupFilePreviewUrls, cleanupReplacedFilePreviewUrl } from './filePreviewUrls';
import { getExtensionFromMimeType } from './fileMime';

describe('file preview URL cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn(),
    });
  });

  it('revokes a single blob preview URL', () => {
    cleanupFilePreviewUrl({ dataUrl: 'blob:preview-1' });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('does not revoke non-blob URLs', () => {
    cleanupFilePreviewUrl({ dataUrl: 'https://example.com/file.png' });

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes replaced blob URLs but preserves reused URLs', () => {
    cleanupReplacedFilePreviewUrl({ dataUrl: 'blob:old-preview' }, { dataUrl: 'blob:new-preview' });
    cleanupReplacedFilePreviewUrl({ dataUrl: 'blob:still-used' }, { dataUrl: 'blob:still-used' });

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old-preview');
  });

  it('keeps the existing multi-file cleanup behavior', () => {
    cleanupFilePreviewUrls([
      { dataUrl: 'blob:preview-1' },
      { dataUrl: 'https://example.com/file.png' },
      { dataUrl: 'blob:preview-2' },
    ]);

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(1, 'blob:preview-1');
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(2, 'blob:preview-2');
  });
});

describe('getExtensionFromMimeType', () => {
  it('keeps generated bitmap image filenames instead of falling back to .bin', () => {
    expect(getExtensionFromMimeType('image/bmp')).toBe('.bmp');
    expect(getExtensionFromMimeType('image/x-portable-pixmap')).toBe('.ppm');
    expect(getExtensionFromMimeType('image/x-portable-graymap')).toBe('.pgm');
    expect(getExtensionFromMimeType('image/x-portable-bitmap')).toBe('.pbm');
    expect(getExtensionFromMimeType('image/x-portable-anymap')).toBe('.pnm');
  });
});
