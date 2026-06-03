import { describe, expect, it } from 'vitest';
import {
  createDataTransferItemsFromEntries,
  createFileSystemDirectoryEntry,
  createFileSystemFileEntry,
} from '@/test/file-system/entries';

import { processDroppedItems } from './droppedItems';

describe('processDroppedItems', () => {
  it('attaches relative paths for dropped file entries', async () => {
    const file = new File(['export const app = true;\n'], 'app.ts', { type: 'text/plain' });
    const items = createDataTransferItemsFromEntries([createFileSystemFileEntry('/demo/src/app.ts', file)]);

    const result = await processDroppedItems(items);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].webkitRelativePath).toBe('demo/src/app.ts');
  });

  it('returns empty directories discovered during drag and drop', async () => {
    const appFile = new File(['export const app = true;\n'], 'app.ts', { type: 'text/plain' });
    const srcEntry = createFileSystemDirectoryEntry('src', '/demo/src', [
      createFileSystemFileEntry('/demo/src/app.ts', appFile),
    ]);
    const emptyEntry = createFileSystemDirectoryEntry('empty', '/demo/empty', []);
    const rootEntry = createFileSystemDirectoryEntry('demo', '/demo', [srcEntry, emptyEntry]);
    const items = createDataTransferItemsFromEntries([rootEntry]);

    const result = await processDroppedItems(items);

    expect(result.files.map((file) => file.webkitRelativePath)).toEqual(['demo/src/app.ts']);
    expect(result.emptyDirectoryPaths).toEqual(['demo/empty']);
  });
});
