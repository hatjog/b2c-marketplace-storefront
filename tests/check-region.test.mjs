import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { checkRegion } = await import('../src/lib/helpers/check-region.ts');

describe('checkRegion (language-based validation, ADR-046)', () => {
  test('pl is valid (supported language)', async () => {
    assert.equal(await checkRegion('pl'), true);
  });

  test('en is valid (supported language)', async () => {
    assert.equal(await checkRegion('en'), true);
  });

  test('us is invalid (country code, not supported language)', async () => {
    assert.equal(await checkRegion('us'), false);
  });

  // cleanup-19: 'de' is now a supported locale in v1.6.0
  test('de is valid (added to SUPPORTED_LOCALES in v1.6.0 cleanup-19)', async () => {
    assert.equal(await checkRegion('de'), true);
  });

  test('empty string is invalid', async () => {
    assert.equal(await checkRegion(''), false);
  });

  test('random string is invalid', async () => {
    assert.equal(await checkRegion('xyz'), false);
  });
});
