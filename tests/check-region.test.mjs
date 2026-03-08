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

  test('de is invalid (not in v1.1.0 supported locales)', async () => {
    assert.equal(await checkRegion('de'), false);
  });

  test('empty string is invalid', async () => {
    assert.equal(await checkRegion(''), false);
  });

  test('random string is invalid', async () => {
    assert.equal(await checkRegion('xyz'), false);
  });
});
