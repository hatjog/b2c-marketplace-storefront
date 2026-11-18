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
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PHASE_1_GATE_SLUG } from '@/lib/content-gate';

import { MIN_DESCRIPTION_WORDS } from '../normalize-listed-products';

const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/smoke-pdp-locales.mjs');
const SMOKE_SOURCE = fs.readFileSync(SMOKE_PATH, 'utf8');

describe('Story 1.3 (1-3-F6) / 1.4 (AD-4) — parity smoke vs checkQualityGate', () => {
  it('slug FAZY 1 w smoke == PHASE_1_GATE_SLUG', () => {
    const match = /const CONTENT_BAR_GATE_SLUG_PHASE_1 = '([a-z]+)';/.exec(SMOKE_SOURCE);

    // Brak stałej = ktoś zmienił kształt smoke'a — parity musi zostać
    // przepięte na nowy mechanizm, nie usunięte.
    expect(match).not.toBeNull();
    expect(match![1]).toBe(PHASE_1_GATE_SLUG);
  });

  it('próg legacy EE-1 w smoke == MIN_DESCRIPTION_WORDS', () => {
    // AD-4 (ecc5efe13): smoke nie ma już literału progu — wiąże swoją stałą z
    // kanonicznym `CONTENT_BAR_THRESHOLDS.product` backendu. Parity przepięte na
    // ten mechanizm (DW-15-326): (1) smoke nadal bierze próg z czytnika
    // kanonicznego, (2) wartość kanoniczna == próg storefrontu.
    expect(SMOKE_SOURCE).toMatch(
      /const MIN_DESCRIPTION_WORDS = readCanonicalProductBarThreshold\(\);/
    );

    // The smoke's own reader runs in a child Node process: vitest's transform
    // cannot load the CLI script (CRLF shebang), and re-implementing the regex
    // here would test a copy instead of the reader HG-6 actually uses.
    const smokeUrl = pathToFileURL(SMOKE_PATH).href;
    const canonical = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(smokeUrl)}); process.stdout.write(String(m.readCanonicalProductBarThreshold()));`
      ],
      { encoding: 'utf8', env: process.env }
    );
    expect(Number(canonical)).toBe(MIN_DESCRIPTION_WORDS);
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
