import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { resolveLang, resolveRegion } = await import('../../src/middleware.ts');

describe('i18n middleware helpers', () => {
  describe('resolveLang', () => {
    test('returns pl for supported language code pl', () => {
      assert.equal(resolveLang('pl'), 'pl');
    });

    test('returns en for supported language code en', () => {
      assert.equal(resolveLang('en'), 'en');
    });

    test('falls back to lang cookie when URL segment unsupported', () => {
      assert.equal(resolveLang('us', 'en'), 'en');
    });

    // cleanup-19: 'de' is now a supported locale — cookie 'de' is used when URL segment 'us' is unsupported
    test('uses cookie locale de when URL segment unsupported and de is in SUPPORTED_LOCALES', () => {
      assert.equal(resolveLang('us', 'de'), 'de');
    });

    test('falls back to default locale pl when URL and cookie both unsupported', () => {
      assert.equal(resolveLang('us', 'xx'), 'pl');
    });

    test('falls back to default locale pl when URL segment empty', () => {
      assert.equal(resolveLang(''), 'pl');
    });

    test('falls back to default locale when no args', () => {
      assert.equal(resolveLang(''), 'pl');
    });

    test('rejects country code us as unsupported (us is not a language)', () => {
      assert.notEqual(resolveLang('us'), 'us');
    });

    test('lang cookie pl is used when URL segment is invalid', () => {
      assert.equal(resolveLang('xyz', 'pl'), 'pl');
    });
  });

  describe('resolveRegion', () => {
    test('returns existing region cookie value if set', () => {
      assert.equal(resolveRegion('de', 'pl'), 'pl');
    });

    test('returns geo IP country when no cookie set', () => {
      assert.equal(resolveRegion('de', undefined), 'de');
    });

    test('returns undefined when neither geo nor cookie available', () => {
      assert.equal(resolveRegion(undefined, undefined), undefined);
    });

    test('returns lowercased geo country code', () => {
      assert.equal(resolveRegion('PL', undefined), 'pl');
    });
  });
});
