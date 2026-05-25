export const formatFileSize = (sizeInBytes: number): string => {
  if (!sizeInBytes) return '';
  if (sizeInBytes < 1024) return `${Math.round(sizeInBytes)} B`;
  const sizeInKb = sizeInBytes / 1024;
  if (sizeInKb < 1024) return `${sizeInKb.toFixed(1)} KB`;
  const sizeInMb = sizeInKb / 1024;
  return `${sizeInMb.toFixed(2)} MB`;
};
