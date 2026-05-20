const normalizePathSeparators = (value: string): string => value.replace(/\\/g, '/');

export const normalizeRelativePath = (value: string): string => normalizePathSeparators(value).replace(/^\/+/, '');

export const getFilePath = (file: File): string => normalizePathSeparators(file.webkitRelativePath || file.name);

export const attachRelativePath = (
  file: File,
  relativePath: string,
  options: { preserveExisting?: boolean } = {},
): File => {
  if (options.preserveExisting && file.webkitRelativePath) {
    return file;
  }

  Object.defineProperty(file, 'webkitRelativePath', {
    configurable: true,
    value: normalizeRelativePath(relativePath),
    writable: true,
  });

  return file;
};
