import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { toHreflang } = await import('../src/lib/helpers/hreflang.ts');

describe('toHreflang', () => {
  test('language code pl maps to pl', () => {
    assert.equal(toHreflang('pl'), 'pl');
  });

  test('language code en maps to en', () => {
    assert.equal(toHreflang('en'), 'en');
  });

  test('country code us maps to en (backward compat)', () => {
    assert.equal(toHreflang('us'), 'en');
  });

  test('country code gb maps to en (backward compat)', () => {
    assert.equal(toHreflang('gb'), 'en');
  });

  test('language code de maps to de', () => {
    assert.equal(toHreflang('de'), 'de');
  });

  test('storefront locale ua maps to Ukrainian BCP-47 uk', () => {
    assert.equal(toHreflang('ua'), 'uk');
  });

  test('unknown code passes through as-is', () => {
    assert.equal(toHreflang('xyz'), 'xyz');
  });
});
