import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

const { toHreflang, toHreflangBare, toLegalMasterFileName, toLegalTemplateLocale, STOREFRONT_LOCALE_MAP } =
  await import('../src/lib/helpers/hreflang.ts');

// R7 invariant: 4-locale platform-wide list per ADR-150 / Story 8.3.
// Deliberately hardcoded here (not imported from routing.ts which requires next-intl at runtime)
// so the parity test can run without the full storefront dependency tree.
// If this list ever changes, update STOREFRONT_LOCALE_MAP in hreflang.ts at the same time.
const EXPECTED_LOCALES = ['de', 'en', 'pl', 'ua'];

describe('toHreflang', () => {
  test('language code pl maps to canonical BCP 47 pl-PL', () => {
    assert.equal(toHreflang('pl'), 'pl-PL');
  });

  test('language code en maps to canonical BCP 47 en-US', () => {
    assert.equal(toHreflang('en'), 'en-US');
  });

  test('language code de maps to canonical BCP 47 de-DE', () => {
    assert.equal(toHreflang('de'), 'de-DE');
  });

  test('storefront locale ua maps to Ukrainian BCP-47 uk', () => {
    assert.equal(toHreflang('ua'), 'uk-UA');
  });

  test('storefront locale ua maps to one canonical Ukrainian locale source', () => {
    assert.equal(toHreflang('ua'), 'uk-UA');
    assert.equal(toHreflangBare('ua'), 'uk');
    assert.equal(toLegalTemplateLocale('ua'), 'uk-UA');
    assert.equal(toLegalMasterFileName('ua'), 'master.uk.md');
  });

  test('unknown code passes through as-is', () => {
    assert.equal(toHreflang('xyz'), 'xyz');
  });

  test('STOREFRONT_LOCALE_MAP keys match 4-locale platform invariant (R7 parity)', () => {
    // Guard: if SUPPORTED_LOCALES gains a 5th locale, STOREFRONT_LOCALE_MAP must be updated too.
    // EXPECTED_LOCALES mirrors SUPPORTED_LOCALES from i18n/routing.ts (ADR-150 4-locale invariant).
    const mapKeys = Object.keys(STOREFRONT_LOCALE_MAP).sort();
    assert.deepEqual(mapKeys, EXPECTED_LOCALES);
  });

  test('toLegalMasterFileName with unknown code falls back to master.md', () => {
    // Runtime guard for type-bypass inputs (route params, unvalidated market.yaml values).
    assert.equal(toLegalMasterFileName('xx'), 'master.md');
  });

  test('toLegalTemplateLocale with unknown code falls back to pl-PL', () => {
    assert.equal(toLegalTemplateLocale('xx'), 'pl-PL');
  });
});
