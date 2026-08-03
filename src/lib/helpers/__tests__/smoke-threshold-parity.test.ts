/**
 * v1.14.0 Story 1.3 (review 1-3-F6), przepięte w Story 1.4 (AD-4).
 *
 * `scripts/smoke-pdp-locales.mjs` lustrzy kontrakt `checkQualityGate`
 * (granica ESM/.mjs vs TS uniemożliwia prosty import w skrypcie node bez tsx).
 * Story 1.4 zmieniła semantykę gate'u z wordcountu na
 * `metadata.gp.content_bar[<slug>].bar`, więc parity NIE zostało usunięte —
 * zostało PRZEPIĘTE na nowy mechanizm i rozszerzone:
 *
 *  1. slug FAZY 1 w smoke == `PHASE_1_GATE_SLUG` z `content-gate.ts`,
 *  2. próg legacy EE-1 w smoke == `MIN_DESCRIPTION_WORDS` (ścieżka legacy nadal
 *     istnieje i nadal musi być zgodna),
 *  3. smoke faktycznie czyta `content_bar` z metadanych, a nie tylko deklaruje
 *     stałą — inaczej „przepięty" byłby deklaracją, nie faktem.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PHASE_1_GATE_SLUG } from '@/lib/content-gate';

import { MIN_DESCRIPTION_WORDS } from '../normalize-listed-products';

const SMOKE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../../../scripts/smoke-pdp-locales.mjs'),
  'utf8'
);

describe('Story 1.3 (1-3-F6) / 1.4 (AD-4) — parity smoke vs checkQualityGate', () => {
  it('slug FAZY 1 w smoke == PHASE_1_GATE_SLUG', () => {
    const match = /const CONTENT_BAR_GATE_SLUG_PHASE_1 = '([a-z]+)';/.exec(SMOKE_SOURCE);

    // Brak stałej = ktoś zmienił kształt smoke'a — parity musi zostać
    // przepięte na nowy mechanizm, nie usunięte.
    expect(match).not.toBeNull();
    expect(match![1]).toBe(PHASE_1_GATE_SLUG);
  });

  it('próg legacy EE-1 w smoke == MIN_DESCRIPTION_WORDS', () => {
    const match = /const MIN_DESCRIPTION_WORDS = (\d+);/.exec(SMOKE_SOURCE);

    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(MIN_DESCRIPTION_WORDS);
  });

  it('smoke klasyfikuje 404 po `content_bar`, nie po samym wordcount', () => {
    // Gdyby ktoś cofnął klasyfikator do liczenia słów, gate i smoke rozjechałyby
    // się dokładnie w release'ie, w którym smoke ma dowodzić HG-6.
    expect(SMOKE_SOURCE).toContain('metadata?.gp?.content_bar');
    expect(SMOKE_SOURCE).toContain('readContentBarFlag(contentBar, gateSlug)');
    expect(SMOKE_SOURCE).toContain('404_gate_description_legacy');
  });

  it('smoke czyta realną fazę z content_gate marketu, nie literał FAZY 1 (review 1-4-F5)', () => {
    // Po flipie FAZY 2 smoke z zaszytą FAZĄ 1 klasyfikowałby 404 po złym slugu
    // i wpisywał do evidence fazę, której market nie ma — czyli tę samą klasę
    // błędu, którą 1.4 naprawiła rozdziałem `404_gate_description(_legacy)`.
    expect(SMOKE_SOURCE).toContain("content_gate");
    expect(SMOKE_SOURCE).toContain('phase_2_locales');
    expect(SMOKE_SOURCE).toMatch(/gateSlugFor\s*=\s*\(locale\)\s*=>/);
    expect(SMOKE_SOURCE).toContain('gate_phase: gatePhaseLabel');
  });
});
