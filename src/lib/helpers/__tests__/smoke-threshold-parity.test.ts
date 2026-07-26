/**
 * v1.14.0 Story 1.3 (review 1-3-F6) — parity progu quality-gate.
 *
 * `scripts/smoke-pdp-locales.mjs` lustrzy MIN_DESCRIPTION_WORDS z
 * `normalize-listed-products.ts` (granica ESM/.mjs vs TS uniemożliwia prosty
 * import w skrypcie node bez tsx). Ten test failuje przy rozjeździe — w
 * szczególności gdy Story 1.4 zmieni semantykę `checkQualityGate` na
 * `metadata.gp.content_bar`: wtedy kopia w smoke stałaby się martwa, a skrypt
 * cicho kłamałby o przyczynach 404 dokładnie w release'ie, w którym ma
 * dowodzić HG-6.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIN_DESCRIPTION_WORDS } from '../normalize-listed-products';

describe('Story 1.3 (1-3-F6) — parity progu smoke vs checkQualityGate', () => {
  it('MIN_DESCRIPTION_WORDS w smoke-pdp-locales.mjs == wartość źródłowa z normalize-listed-products', () => {
    const smokeSource = fs.readFileSync(
      path.resolve(__dirname, '../../../../scripts/smoke-pdp-locales.mjs'),
      'utf8'
    );
    const match = /const MIN_DESCRIPTION_WORDS = (\d+);/.exec(smokeSource);

    // Brak stałej = ktoś zmienił kształt smoke'a — parity musi zostać
    // przepięte na nowy mechanizm, nie usunięte.
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MIN_DESCRIPTION_WORDS);
  });
});
