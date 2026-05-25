import fs from 'fs';
import path from 'path';

export const projectRoot = path.resolve(__dirname, '../../..');
const srcRoot = path.join(projectRoot, 'src');

export const readProjectFile = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

export const readSourceFile = (relativePath: string) => fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');

export const listProjectSourceFiles = (relativeDir: string): string[] => {
  const absoluteDir = path.join(projectRoot, relativeDir);
  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        return listProjectSourceFiles(entryPath);
      }
      return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    })
    .sort();
};

export const countLines = (source: string): number => source.split('\n').length;
