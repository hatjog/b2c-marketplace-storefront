import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

const { toHreflang } = await import('../src/lib/helpers/hreflang.ts');

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

  test('unknown code passes through as-is', () => {
    assert.equal(toHreflang('xyz'), 'xyz');
  });
});
