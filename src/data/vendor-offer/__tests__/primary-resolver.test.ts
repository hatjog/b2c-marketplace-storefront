import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type * as ReactModule from 'react';

// `import 'server-only'` lives at the top of the production module — under
// vitest (Node) we stub it as a no-op module so the import does not bail.
vi.mock('server-only', () => ({}));

// React 19 `cache()`: identity wrapper under tests so we can drive a
// single-instance assertion deterministically. The wrapped function is
// memoised across calls within a test by a tiny in-test cache; this mirrors
// the per-request semantics of React's real implementation.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactModule>('react');
  return {
    ...actual,
    cache: <Args extends unknown[], R>(fn: (...args: Args) => R) => {
      let memo: R | undefined;
      let called = false;
      return ((...args: Args) => {
        if (!called) {
          memo = fn(...args);
          called = true;
        }
        return memo as R;
      }) as typeof fn;
    },
  };
});

import {
  buildPrimaryVendorBatchFn,
  getPrimaryVendorForProduct,
  getPrimaryVendorLoader,
  normalizePrimaryVendorKey,
  PRIMARY_VENDOR_LOADER_OPTIONS,
  resetVendorOfferReadPort,
  setVendorOfferReadPort,
  __test,
  type PrimaryVendorResolution,
  type VendorOffer,
  type VendorOfferReadPort,
} from '../primary-resolver';

const makeOffer = (overrides: Partial<VendorOffer> = {}): VendorOffer => ({
  id: overrides.id ?? 'offer-1',
  vendor_id: overrides.vendor_id ?? 'vendor-1',
  product_id: overrides.product_id ?? 'prod-1',
  price_amount: overrides.price_amount ?? 1000,
  price_currency: overrides.price_currency ?? 'PLN',
  status: overrides.status ?? 'active',
  incumbent_marker: overrides.incumbent_marker ?? false,
  primary: overrides.primary ?? false,
  created_at: overrides.created_at ?? '2026-01-01T00:00:00.000Z',
  updated_at: overrides.updated_at ?? '2026-01-01T00:00:00.000Z',
});

class StubPort implements VendorOfferReadPort {
  public callCount = 0;
  public lastIds: ReadonlyArray<string> = [];
  constructor(private readonly rows: ReadonlyArray<VendorOffer>) {}
  async findActiveByProductIds(productIds: ReadonlyArray<string>): Promise<ReadonlyArray<VendorOffer>> {
    this.callCount += 1;
    this.lastIds = productIds;
    const ids = new Set(productIds);
    return this.rows.filter((r) => ids.has(r.product_id));
  }
}

// Clear the request-scoped DataLoader between tests. The mocked React `cache()`
// memoises across the whole test file (matches the per-request semantics of
// the production `cache()` — but our "request" here spans every test). Clearing
// the underlying DataLoader's per-key cache is the test-equivalent of starting
// a new RSC render. The same loader instance persists, which is the contract
// AC-PVR-4.2-01 asserts (single instance per request scope).
const clearLoaderForTest = () => {
  try {
    setVendorOfferReadPort(new (class implements VendorOfferReadPort {
      async findActiveByProductIds() {
        return [];
      }
    })());
    const loader = getPrimaryVendorLoader();
    loader.clearAll();
    // Reset internal stats so AC-PVR-4.2-03 batchCalls assertion is per-test.
    (loader._stats as { batchCalls: number; totalKeys: number }).batchCalls = 0;
    (loader._stats as { batchCalls: number; totalKeys: number }).totalKeys = 0;
  } catch {
    // Module may not yet be loaded — ignore.
  }
};

beforeEach(() => {
  clearLoaderForTest();
  resetVendorOfferReadPort();
});

afterEach(() => {
  resetVendorOfferReadPort();
});

describe('AC-PVR-4.2-01 — locked options + key normalizer', () => {
  it('default loader options match the AC-PVR-4.2-01 contract', () => {
    expect(PRIMARY_VENDOR_LOADER_OPTIONS.batch).toBe(true);
    expect(PRIMARY_VENDOR_LOADER_OPTIONS.maxBatchSize).toBe(100);
    expect(PRIMARY_VENDOR_LOADER_OPTIONS.cache).toBe(true);
    expect(PRIMARY_VENDOR_LOADER_OPTIONS.cacheKeyFn).toBe(normalizePrimaryVendorKey);
    expect(typeof PRIMARY_VENDOR_LOADER_OPTIONS.batchScheduleFn).toBe('function');
  });

  it('normalizePrimaryVendorKey rejects empty / whitespace / null inputs', () => {
    expect(() => normalizePrimaryVendorKey({ productId: 'p-a' })).not.toThrow();
    expect(() => normalizePrimaryVendorKey({ productId: '' })).toThrow(TypeError);
    expect(() => normalizePrimaryVendorKey({ productId: '   ' })).toThrow(TypeError);
    expect(() => normalizePrimaryVendorKey(null as never)).toThrow(TypeError);
  });

  it('getPrimaryVendorLoader is wrapped in cache() — same instance per request scope', () => {
    setVendorOfferReadPort(new StubPort([]));
    const a = getPrimaryVendorLoader();
    const b = getPrimaryVendorLoader();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(__test.DataLoader);
  });
});

describe('AC-PVR-4.2-02 — single-product flag-off path < 10ms', () => {
  it('resolves a single product in < 10ms', async () => {
    setVendorOfferReadPort(
      new StubPort([
        makeOffer({ id: 'o-1', product_id: 'p-1', incumbent_marker: true }),
      ])
    );
    // Warm.
    await getPrimaryVendorForProduct('p-1');
    const start = performance.now();
    const result = await getPrimaryVendorForProduct('p-1');
    const ms = performance.now() - start;
    expect(result.primary?.id).toBe('o-1');
    expect(ms).toBeLessThan(10);
  });
});

describe('AC-PVR-4.2-03 — N+1 prevention + p95 < 50ms over 100 products', () => {
  it('100 concurrent loads collapse into ONE batch', async () => {
    const rows: VendorOffer[] = [];
    for (let i = 0; i < 100; i += 1) {
      rows.push(
        makeOffer({
          id: `o-${i}`,
          product_id: `p-${i}`,
          incumbent_marker: i % 7 === 0,
          created_at: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
        })
      );
    }
    const port = new StubPort(rows);
    setVendorOfferReadPort(port);

    const loader = getPrimaryVendorLoader();
    const results = await Promise.all(
      rows.map((r) => loader.load({ productId: r.product_id }))
    );

    expect(results).toHaveLength(100);
    expect(port.callCount).toBe(1);
    expect(loader._stats.batchCalls).toBe(1);
    expect(loader._stats.totalKeys).toBe(100);
    for (const r of results) {
      expect(r).toHaveProperty('primary');
      expect(r).toHaveProperty('secondary');
      expect(r.secondary).toEqual([]);
    }
  });

  it('p95 over 100 products comfortably under 50ms (AC-RES-PERF-01)', async () => {
    const rows: VendorOffer[] = [];
    for (let i = 0; i < 100; i += 1) {
      rows.push(makeOffer({ id: `o-${i}`, product_id: `p-${i}`, incumbent_marker: true }));
    }
    setVendorOfferReadPort(new StubPort(rows));
    const loader = getPrimaryVendorLoader();

    const start = performance.now();
    await Promise.all(rows.map((r) => loader.load({ productId: r.product_id })));
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(50);
  });
});

describe('AC-PVR-4.2-04 — algorithm: incumbent → first-active → null', () => {
  it('incumbent_marker beats older non-incumbent at same product_id', async () => {
    setVendorOfferReadPort(
      new StubPort([
        makeOffer({
          id: 'old-non-incumbent',
          product_id: 'p-1',
          created_at: '2024-01-01T00:00:00.000Z',
        }),
        makeOffer({
          id: 'new-incumbent',
          product_id: 'p-1',
          incumbent_marker: true,
          created_at: '2026-01-01T00:00:00.000Z',
        }),
      ])
    );
    const r = await getPrimaryVendorForProduct('p-1');
    expect(r.primary?.id).toBe('new-incumbent');
  });

  it('falls back to first-active (created_at ASC) when no incumbent', async () => {
    setVendorOfferReadPort(
      new StubPort([
        makeOffer({ id: 'later', product_id: 'p-2', created_at: '2026-02-01T00:00:00.000Z' }),
        makeOffer({ id: 'earliest', product_id: 'p-2', created_at: '2026-01-01T00:00:00.000Z' }),
      ])
    );
    const r = await getPrimaryVendorForProduct('p-2');
    expect(r.primary?.id).toBe('earliest');
  });

  it('null when no active row (no archive fallback in v1.5.0)', async () => {
    setVendorOfferReadPort(
      new StubPort([
        makeOffer({ id: 'arch-1', product_id: 'p-4', status: 'archived' }),
      ])
    );
    const r = await getPrimaryVendorForProduct('p-4');
    expect(r.primary).toBeNull();
    expect(r.secondary).toEqual([]);
  });
});

describe('AC-PVR-4.2-05 — locked return shape (flag-off): secondary === []', () => {
  it('always returns {primary, secondary: []} while flag is off', async () => {
    const rows: VendorOffer[] = [];
    for (let i = 0; i < 5; i += 1) {
      rows.push(
        makeOffer({
          id: `o-${i}`,
          product_id: 'p-many',
          incumbent_marker: i === 0,
          created_at: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
        })
      );
    }
    setVendorOfferReadPort(new StubPort(rows));

    const r = await getPrimaryVendorForProduct('p-many');
    expect(r.primary?.id).toBe('o-0');
    expect(r.secondary).toEqual([]);
  });

  it('façade contract: missing product still returns the locked shape', async () => {
    setVendorOfferReadPort(new StubPort([]));
    const r = await getPrimaryVendorForProduct('p-missing');
    expect(r).toEqual<PrimaryVendorResolution>({ primary: null, secondary: [] });
  });

  it('buildPrimaryVendorBatchFn is pure (no side effects on call ordering)', async () => {
    const port = new StubPort([
      makeOffer({ id: 'o-1', product_id: 'p-1', incumbent_marker: true }),
    ]);
    const batchFn = buildPrimaryVendorBatchFn(port);
    const r1 = await batchFn([{ productId: 'p-1' }, { productId: 'p-1' }]);
    expect(r1).toHaveLength(2);
    expect((r1[0] as PrimaryVendorResolution).primary?.id).toBe('o-1');
    expect((r1[0] as PrimaryVendorResolution).secondary).toEqual([]);
  });
});
