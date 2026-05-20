import { describe, expect, it } from 'vitest';
import { HD_GUIDE_SYSTEM_PROMPT } from './vision';

describe('HD_GUIDE_SYSTEM_PROMPT', () => {
  it('keeps arrow annotation code on the Pillow path supported by local Python', () => {
    expect(HD_GUIDE_SYSTEM_PROMPT).toContain('Pillow');
    expect(HD_GUIDE_SYSTEM_PROMPT).toContain('PIL');
    expect(HD_GUIDE_SYSTEM_PROMPT).toContain('不要导入 `cv2`');
    expect(HD_GUIDE_SYSTEM_PROMPT).toContain('os.listdir');
  });
});
