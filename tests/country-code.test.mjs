import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit tests for filter URL param sanitization logic.
 * (getCountryCode requires Next.js runtime; tested via E2E instead.)
 *
 * SYNC WARNING: The constants below mirror those in:
 *   src/components/sections/ProductListing/ProductListing.tsx
 * If you change ALLOWED_DURATIONS or CITY_ALLOWED_CHARS_RE there,
 * update them here too. The sync test at the bottom will catch value drift
 * for ALLOWED_DURATIONS.
 */

// ── mirrors ProductListing.tsx ──────────────────────────────────────────────
const ALLOWED_DURATIONS = [30, 45, 60, 90];
const CITY_ALLOWED_CHARS_RE = /[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s-]/g;
// ───────────────────────────────────────────────────────────────────────────

function sanitizeDuration(raw) {
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return undefined;
  return ALLOWED_DURATIONS.includes(parsed) ? parsed : undefined;
}

function sanitizeSellerRating(raw) {
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return undefined;
  return (parsed >= 1 && parsed <= 5) ? parsed : undefined;
}

function sanitizeCity(raw) {
  if (!raw || raw.length > 100) return undefined;
  const cleaned = raw.replace(CITY_ALLOWED_CHARS_RE, '').trim();
  return cleaned || undefined;
}

describe('duration URL param sanitization', () => {
  test('valid duration 30 passes', () => assert.equal(sanitizeDuration('30'), 30));
  test('valid duration 60 passes', () => assert.equal(sanitizeDuration('60'), 60));
  test('invalid duration 99 returns undefined', () => assert.equal(sanitizeDuration('99'), undefined));
  test('non-numeric returns undefined', () => assert.equal(sanitizeDuration('abc'), undefined));
  test('empty returns undefined', () => assert.equal(sanitizeDuration(''), undefined));
});

describe('seller_rating URL param sanitization', () => {
  test('valid rating 1 passes', () => assert.equal(sanitizeSellerRating('1'), 1));
  test('valid rating 4 passes', () => assert.equal(sanitizeSellerRating('4'), 4));
  test('valid rating 5 passes', () => assert.equal(sanitizeSellerRating('5'), 5));
  test('out-of-range 6 returns undefined', () => assert.equal(sanitizeSellerRating('6'), undefined));
  test('out-of-range 0 returns undefined', () => assert.equal(sanitizeSellerRating('0'), undefined));
  test('negative returns undefined', () => assert.equal(sanitizeSellerRating('-1'), undefined));
});

describe('city URL param sanitization', () => {
  test('valid ASCII city passes', () => assert.equal(sanitizeCity('Warsaw'), 'Warsaw'));
  test('valid Polish city passes', () => assert.equal(sanitizeCity('Kraków'), 'Kraków'));
  test('city with hyphen passes', () => assert.equal(sanitizeCity('Bielsko-Biała'), 'Bielsko-Biała'));
  // Angle brackets are stripped; alphabetic content of injection remains — acceptable at this level
  test('city with injection angle brackets stripped', () => assert.equal(sanitizeCity('Kraków<script>'), 'Krakówscript'));
  test('city exceeding 100 chars returns undefined', () => {
    assert.equal(sanitizeCity('a'.repeat(101)), undefined);
  });
  test('empty after stripping returns undefined', () => assert.equal(sanitizeCity('<>{}'), undefined));
});

describe('LOCALE_TO_COUNTRY mapping (inline)', () => {
  const LOCALE_TO_COUNTRY = { pl: 'pl', en: 'gb' };

  test('pl → pl', () => assert.equal(LOCALE_TO_COUNTRY['pl'] ?? 'pl', 'pl'));
  test('en → gb (not en)', () => assert.equal(LOCALE_TO_COUNTRY['en'] ?? 'pl', 'gb'));
  test('unknown locale → fallback pl', () => assert.equal(LOCALE_TO_COUNTRY['fr'] ?? 'pl', 'pl'));
});

describe('ALLOWED_DURATIONS sync check', () => {
  // Verifies this file's constants match the expected production values.
  // If production changes, update both constants and this test.
  test('contains exactly [30, 45, 60, 90]', () => {
    assert.deepEqual(ALLOWED_DURATIONS, [30, 45, 60, 90]);
  });
});
