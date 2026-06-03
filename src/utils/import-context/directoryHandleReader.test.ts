import { describe, expect, it } from 'vitest';
import { createFileSystemDirectoryHandle, createFileSystemFileHandle } from '@/test/file-system/entries';

import { readDirectoryHandle } from './directoryHandleReader';

describe('readDirectoryHandle', () => {
  it('skips default ignored directories by default', async () => {
    const handle = createFileSystemDirectoryHandle('demo', [
      createFileSystemDirectoryHandle('node_modules', [
        createFileSystemFileHandle('index.ts', 'export const pkg = true;\n'),
      ]),
      createFileSystemDirectoryHandle('src', [createFileSystemFileHandle('app.ts', 'export const app = true;\n')]),
    ]);

    const result = await readDirectoryHandle(handle);

    expect(result.files.map((file) => file.webkitRelativePath)).toEqual(['demo/src/app.ts']);
  });

  it('keeps empty directories in the result', async () => {
    const handle = createFileSystemDirectoryHandle('demo', [
      createFileSystemDirectoryHandle('empty', []),
      createFileSystemDirectoryHandle('src', [createFileSystemFileHandle('app.ts', 'export const app = true;\n')]),
    ]);

    const result = await readDirectoryHandle(handle);

    expect(result.emptyDirectoryPaths).toEqual(['demo/empty']);
    expect(result.files.map((file) => file.webkitRelativePath)).toEqual(['demo/src/app.ts']);
  });
});
