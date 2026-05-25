export interface DroppedItemsSnapshot {
  entries: FileSystemEntry[];
  handlePromises: Promise<FileSystemHandle | null>[];
  files: File[];
}

export const createEmptyDroppedItemsSnapshot = (): DroppedItemsSnapshot => ({
  entries: [],
  handlePromises: [],
  files: [],
});

export function snapshotDroppedItems(items: DataTransferItemList): DroppedItemsSnapshot {
  const entries: FileSystemEntry[] = [];
  const handlePromises: Promise<FileSystemHandle | null>[] = [];
  const files: File[] = [];

  for (const item of Array.from(items)) {
    if (item.kind !== 'file') {
      continue;
    }

    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
      continue;
    }

    const handlePromise = item.getAsFileSystemHandle?.();
    if (handlePromise) {
      handlePromises.push(handlePromise);
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }

  return { entries, handlePromises, files };
}
