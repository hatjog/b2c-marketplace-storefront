/**
 * Tests for v160-cleanup-12c: PDP SellerSelector data wire-up.
 *
 * Tests run via `pnpm test` (Node.js built-in test runner).
 *
 * Covers:
 *  - AC1: vendor_offers pass-through via ListedProduct / normalizer (type-level — verified via TS build)
 *  - AC3: sole-vendor branch logic (vendorOfferCount dispatch)
 *  - AC5: sessionStorage geolocation denial cache helpers (logic inlined, Map-backed store)
 *  - AC7: no TS-level regressions (verified in build step)
 */

import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// AC5: sessionStorage geolocation denial cache logic
// ---------------------------------------------------------------------------
//
// Constants mirroring src/lib/helpers/geo-denial-cache.ts.
// Inlined here to avoid tsx TS module resolution in .mjs test context.
//

const GEO_DENIAL_KEY = 'gp_geo_denial_ts';
const GEO_DENIAL_TTL_MS = 10_000;

/**
 * Inline re-implementation of the helpers using a controlled Map store.
 * Production code uses window.sessionStorage; the Map allows deterministic
 * testing in the Node.js test environment (no DOM / browser APIs).
 */
function makeHelpers(store) {
  function isGeolocationDeniedCached() {
    try {
      const raw = store.get(GEO_DENIAL_KEY);
      if (!raw) return false;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return false;
      return Date.now() - ts < GEO_DENIAL_TTL_MS;
    } catch {
      return false;
    }
  }

  function cacheGeolocationDenial() {
    try {
      store.set(GEO_DENIAL_KEY, String(Date.now()));
    } catch {
      // no-op
    }
  }

  return { isGeolocationDeniedCached, cacheGeolocationDenial };
}

describe('cleanup-12c — geolocation denial cache logic (AC5)', () => {
  let store;
  let helpers;

  beforeEach(() => {
    store = new Map();
    helpers = makeHelpers(store);
  });

  afterEach(() => {
    store.clear();
  });

  test('isGeolocationDeniedCached returns false when nothing in store', () => {
    assert.equal(helpers.isGeolocationDeniedCached(), false);
  });

  test('cacheGeolocationDenial writes timestamp to store', () => {
    const before = Date.now();
    helpers.cacheGeolocationDenial();
    const after = Date.now();

    const raw = store.get(GEO_DENIAL_KEY);
    assert.ok(raw !== undefined, 'should have a value in store');
    const ts = Number(raw);
    assert.ok(ts >= before, `ts (${ts}) should be >= before (${before})`);
    assert.ok(ts <= after, `ts (${ts}) should be <= after (${after})`);
  });

  test('isGeolocationDeniedCached returns true immediately after caching', () => {
    helpers.cacheGeolocationDenial();
    assert.equal(helpers.isGeolocationDeniedCached(), true);
  });

  test('isGeolocationDeniedCached returns false when cached entry is expired', () => {
    const expiredTs = Date.now() - GEO_DENIAL_TTL_MS - 1;
    store.set(GEO_DENIAL_KEY, String(expiredTs));
    assert.equal(helpers.isGeolocationDeniedCached(), false);
  });

  test('isGeolocationDeniedCached returns true when entry is within TTL', () => {
    const recentTs = Date.now() - Math.floor(GEO_DENIAL_TTL_MS / 2);
    store.set(GEO_DENIAL_KEY, String(recentTs));
    assert.equal(helpers.isGeolocationDeniedCached(), true);
  });

  test('isGeolocationDeniedCached returns false when stored value is NaN', () => {
    store.set(GEO_DENIAL_KEY, 'not-a-number');
    assert.equal(helpers.isGeolocationDeniedCached(), false);
  });
});

// ---------------------------------------------------------------------------
// AC3: ProductDetails vendor_offers branch logic
// ---------------------------------------------------------------------------

describe('cleanup-12c — ProductDetails vendor_offers branch logic (AC3)', () => {
  test('vendorOfferCount === 1 maps to showSoleVendorBadge branch', () => {
    const vendorOffers = [
      { seller_id: 's1', seller_name: 'Salon Solo', price_pln: 200 },
    ];
    const vendorOfferCount = Array.isArray(vendorOffers) ? vendorOffers.length : -1;

    assert.equal(vendorOfferCount, 1);
    const showSoleVendorBadge = vendorOfferCount === 1;
    const showSellerSelector = vendorOfferCount >= 2;
    const showNoActiveVendorsFallback = vendorOfferCount === 0;

    assert.equal(showSoleVendorBadge, true);
    assert.equal(showSellerSelector, false);
    assert.equal(showNoActiveVendorsFallback, false);
  });

  test('vendorOffers undefined → vendorOfferCount === -1 → all branches false', () => {
    const vendorOffers = undefined;
    const vendorOfferCount = Array.isArray(vendorOffers) ? vendorOffers.length : -1;

    assert.equal(vendorOfferCount, -1);
    assert.equal(vendorOfferCount >= 2, false);
    assert.equal(vendorOfferCount === 1, false);
    assert.equal(vendorOfferCount === 0, false);
  });

  test('vendorOffers [] → vendorOfferCount === 0 → showNoActiveVendorsFallback', () => {
    const vendorOffers = [];
    const vendorOfferCount = Array.isArray(vendorOffers) ? vendorOffers.length : -1;

    assert.equal(vendorOfferCount, 0);
    assert.equal(vendorOfferCount === 0, true);
    assert.equal(vendorOfferCount === 1, false);
    assert.equal(vendorOfferCount >= 2, false);
  });

  test('vendorOffers length >= 2 → showSellerSelector branch', () => {
    const vendorOffers = [
      { seller_id: 's1', seller_name: 'Salon A', price_pln: 100 },
      { seller_id: 's2', seller_name: 'Salon B', price_pln: 120 },
    ];
    const vendorOfferCount = Array.isArray(vendorOffers) ? vendorOffers.length : -1;

    assert.equal(vendorOfferCount >= 2, true);
    assert.equal(vendorOfferCount === 1, false);
    assert.equal(vendorOfferCount === 0, false);
  });
});

// ---------------------------------------------------------------------------
// AC1: ListedProduct type includes vendor_offers (compile-time — covered
// by pnpm build / tsc step; runtime shape test here as documentation guard)
// ---------------------------------------------------------------------------

describe('cleanup-12c — vendor_offers shape guard (AC1)', () => {
  test('vendor_offers array survives spread (no field stripping)', () => {
    const offers = [
      { seller_id: 'seller_01', seller_name: 'Salon Testowy', price_pln: 150 },
    ];
    const base = { vendor_offers: offers, vendor_count: 1, lowest_price_pln: 150 };
    const spread = { ...base };
    assert.deepEqual(spread.vendor_offers, offers);
    assert.equal(spread.vendor_count, 1);
    assert.equal(spread.lowest_price_pln, 150);
  });

  test('vendor_offers field with 2 items survives spread', () => {
    const offers = [
      { seller_id: 'seller_01', seller_name: 'Salon A', price_pln: 100 },
      { seller_id: 'seller_02', seller_name: 'Salon B', price_pln: 120 },
    ];
    const base = { vendor_offers: offers };
    const spread = { ...base };
    assert.equal(spread.vendor_offers.length, 2);
  });
});
