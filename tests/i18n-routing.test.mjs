import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale } = await import('../src/i18n/routing.ts');

describe('i18n routing', () => {
  test('SUPPORTED_LOCALES contains pl and en', () => {
    assert.ok(SUPPORTED_LOCALES.includes('pl'));
    assert.ok(SUPPORTED_LOCALES.includes('en'));
  });

  test('DEFAULT_LOCALE is pl', () => {
    assert.equal(DEFAULT_LOCALE, 'pl');
  });

  test('isSupportedLocale returns true for pl', () => {
    assert.equal(isSupportedLocale('pl'), true);
  });

  test('isSupportedLocale returns true for en', () => {
    assert.equal(isSupportedLocale('en'), true);
  });

  test('isSupportedLocale returns false for country code us', () => {
    assert.equal(isSupportedLocale('us'), false);
  });

  test('isSupportedLocale returns false for unknown code', () => {
    assert.equal(isSupportedLocale('xyz'), false);
  });

  test('isSupportedLocale returns false for empty string', () => {
    assert.equal(isSupportedLocale(''), false);
  });

  test('isSupportedLocale returns false for de (not in v1.1.0 scope)', () => {
    assert.equal(isSupportedLocale('de'), false);
  });
});
