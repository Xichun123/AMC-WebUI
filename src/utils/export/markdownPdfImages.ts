import { isImageMimeType } from '@/utils/fileTypeClassification';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Image could not be converted for PDF export.'));
      }
    };
    reader.onerror = () => reject(new Error('Image could not be read for PDF export.'));
    reader.readAsDataURL(blob);
  });

const fetchImageSourceAsDataUrl = async (src: string): Promise<string | null> => {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    if (!isImageMimeType(blob.type)) {
      return null;
    }

    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
};

export const fetchImageAsDataUrl = async (src: string): Promise<string | null> => {
  if (src.startsWith('data:image/')) {
    return src;
  }

  const sources = /^https?:\/\//i.test(src) ? [`/api/image-proxy?url=${encodeURIComponent(src)}`, src] : [src];

  for (const source of sources) {
    const dataUrl = await fetchImageSourceAsDataUrl(source);
    if (dataUrl) {
      return dataUrl;
    }
  }

  return null;
};

export const getImageSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => resolve({ width: 1200, height: 675 }), 3000);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve({
        width: image.naturalWidth || image.width || 1200,
        height: image.naturalHeight || image.height || 675,
      });
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve({ width: 1200, height: 675 });
    };
    image.src = src;
  });

export const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' => {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
};
