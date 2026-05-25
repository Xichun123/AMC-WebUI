import type { ImportContextBuildOptions, PathFileInput } from './importContextBuilder';

export const generateFolderContext = async (
  files: FileList | File[] | PathFileInput[],
  options: ImportContextBuildOptions = {},
): Promise<File> => {
  const { buildImportContextFile } = await import('./importContextBuilder');
  return buildImportContextFile(files, options);
};

export const generateZipContext = async (zipFile: File, options: ImportContextBuildOptions = {}): Promise<File> => {
  const { generateZipContext: generateZipImportContext } = await import('./importContextBuilder');
  return generateZipImportContext(zipFile, options);
};
