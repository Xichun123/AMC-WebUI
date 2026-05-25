export const decodeBase64ToArrayBuffer = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const byteLength = binaryString.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Reads a Blob or File and returns it as a Base64 string (without the data URI prefix).
 * Used primarily just before sending data to the API.
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      if (base64Data) {
        resolve(base64Data);
      } else {
        reject(new Error('Failed to extract base64 data from blob.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
};

export const fileToString = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteArray = decodeBase64ToArrayBuffer(base64);
  const buffer = new ArrayBuffer(byteArray.byteLength);
  new Uint8Array(buffer).set(byteArray);
  return new Blob([buffer], { type: mimeType });
};
