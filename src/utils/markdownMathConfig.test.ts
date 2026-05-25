import { describe, expect, it } from 'vitest';

import { containsTexMathMarkdown } from './markdownMathConfig';

describe('containsTexMathMarkdown', () => {
  it('detects inline and block TeX math markdown', () => {
    expect(containsTexMathMarkdown('Use $x$ in the explanation.')).toBe(true);
    expect(containsTexMathMarkdown('Use $x + 1$ in the explanation.')).toBe(true);
    expect(containsTexMathMarkdown('Use $$x$$ in the explanation.')).toBe(true);
    expect(containsTexMathMarkdown('Use $$\\frac{1}{2}$$ in the explanation.')).toBe(true);
  });

  it('ignores plain text and escaped dollar signs', () => {
    expect(containsTexMathMarkdown('plain text without math')).toBe(false);
    expect(containsTexMathMarkdown('cost is \\$5 and no math')).toBe(false);
    expect(containsTexMathMarkdown('cost is $5 and no closing delimiter')).toBe(false);
  });
});
