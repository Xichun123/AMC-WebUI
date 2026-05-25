import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { projectRoot, readProjectFile } from './projectFiles';

describe('database structure boundaries', () => {
  it('keeps IndexedDB service orchestration split into focused modules', () => {
    const dbServiceSource = readProjectFile('src/services/db/dbService.ts');

    for (const relativePath of [
      'src/services/db/dbSchema.ts',
      'src/services/db/indexedDbAccess.ts',
      'src/services/db/sessionRecords.ts',
      'src/services/db/logRecords.ts',
      'src/services/db/apiUsageRecords.ts',
      'src/services/db/appDataSize.ts',
    ]) {
      expect(fs.existsSync(path.join(projectRoot, relativePath)), relativePath).toBe(true);
    }

    expect(fs.existsSync(path.join(projectRoot, 'src/services/db/idbUtils.ts'))).toBe(false);
    expect(dbServiceSource).toContain("from './sessionRecords'");
    expect(dbServiceSource).toContain("from './logRecords'");
    expect(dbServiceSource).toContain("from './apiUsageRecords'");
    expect(dbServiceSource).toContain("from './appDataSize'");
    expect(dbServiceSource).not.toContain('const estimateStoredValueBytes =');
    expect(dbServiceSource).not.toContain('const persistSessionRecord =');
    expect(dbServiceSource).not.toContain('const getSessionFileRecords =');
    expect(dbServiceSource.length).toBeLessThan(12000);
  });
});
