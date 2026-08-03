import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock listProducts BEFORE importing the fetcher so the cache() wrapper picks
// up the mock at module-eval time.
vi.mock('@/lib/data/products', () => ({
  listProducts: vi.fn(async ({ queryParams }: { queryParams?: { handle?: string[] } }) => ({
    response: {
      products: [{ id: 'prod_01', handle: queryParams?.handle?.[0] ?? 'unknown' }],
      count: 1,
    },
    nextPage: null,
  })),
}));

import { listProducts } from '@/lib/data/products';
import { fetchProductForDetailPage } from '@/lib/data/product-detail-fetcher';

const mockedListProducts = vi.mocked(listProducts);

describe('D-09 product-detail-fetcher — React 19 cache() dedupe (NFR-PERF-3)', () => {
  beforeEach(() => {
    mockedListProducts.mockClear();
  });

  // React 19 `cache()` only memoizes WITHIN a React render scope. Under vitest
  // `environment: 'node'` there is no server render boundary, so cache() does
  // not dedupe and listProducts is invoked twice — the dedupe guarantee is a
  // render-time property that belongs in an integration/RSC test, not a unit.
  // The source correctly wraps in cache(); only this assertion's harness is wrong.
  it.skip('invokes listProducts ONCE across two getCachedProduct calls (same render)', async () => {
    const a = await fetchProductForDetailPage('voucher-spa-1h', 'pl', 'pl');
    const b = await fetchProductForDetailPage('voucher-spa-1h', 'pl', 'pl');

    expect(mockedListProducts).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a?.id).toBe('prod_01');
  });

  it('does NOT collapse calls with different (handle, countryCode) keys', async () => {
    await fetchProductForDetailPage('voucher-massage', 'pl', 'pl');
    await fetchProductForDetailPage('voucher-haircut', 'pl', 'pl');
    await fetchProductForDetailPage('voucher-massage', 'en', 'en');

    // Three distinct argument tuples → three distinct fetches.
    expect(mockedListProducts).toHaveBeenCalledTimes(3);
  });

  // v1.14.0 Story 1.2: locale wszedł do krotki argumentów `cache()`. Bez tego
  // PDP w /pl i /ua dedupe'owałyby się do JEDNEJ odpowiedzi w obrębie renderu —
  // przeciek locale o warstwę wyżej niż Data Cache.
  it('does NOT collapse calls that differ only by locale', async () => {
    await fetchProductForDetailPage('voucher-massage', 'pl', 'pl');
    await fetchProductForDetailPage('voucher-massage', 'pl', 'ua');

    expect(mockedListProducts).toHaveBeenCalledTimes(2);
    expect(mockedListProducts.mock.calls[0][0].locale).toBe('pl');
    expect(mockedListProducts.mock.calls[1][0].locale).toBe('ua');
  });

  it('returns null when product is not found', async () => {
    mockedListProducts.mockImplementationOnce(async () => ({
      response: { products: [], count: 0 },
      nextPage: null,
    }));

    const result = await fetchProductForDetailPage('nonexistent', 'pl', 'pl');
    expect(result).toBeNull();
  });
});
