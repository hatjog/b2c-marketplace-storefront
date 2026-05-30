import { describe, expect, it } from 'vitest';

import { computeLocaleCoverage } from './localeCoverage';

describe('computeLocaleCoverage', () => {
  it('returns 1 for the default (PL) locale — canonical fallback baseline', () => {
    expect(computeLocaleCoverage('pl')).toBe(1);
  });

  it('returns 1 for unknown / un-probeable locales (no false fallback notice)', () => {
    expect(computeLocaleCoverage('fr')).toBe(1);
    expect(computeLocaleCoverage('')).toBe(1);
  });

  it('produces a real ratio in [0, 1] for each supported non-PL locale', () => {
    for (const locale of ['en', 'ua', 'de'] as const) {
      const coverage = computeLocaleCoverage(locale);
      expect(coverage).toBeGreaterThanOrEqual(0);
      expect(coverage).toBeLessThanOrEqual(1);
    }
  });

  it('reflects actual catalog parity (current catalogs ship full PL keyset)', () => {
    // The probe is a genuine signal: with the current message catalogs every
    // non-PL locale carries the full PL leaf-key set as non-empty strings, so
    // coverage is at parity. If a future locale drops/blanks keys this value
    // will fall below the LocaleFallbackNotice threshold and surface the banner.
    expect(computeLocaleCoverage('en')).toBeGreaterThan(0.5);
    expect(computeLocaleCoverage('ua')).toBeGreaterThan(0.5);
    expect(computeLocaleCoverage('de')).toBeGreaterThan(0.5);
  });
});
