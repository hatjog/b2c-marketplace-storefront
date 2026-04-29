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

  it('invokes listProducts ONCE across two getCachedProduct calls (same render)', async () => {
    // First call (route page.tsx generateMetadata + render)
    const a = await fetchProductForDetailPage('voucher-spa-1h', 'pl');
    // Second call (ProductDetailsPage server component, same render tree)
    const b = await fetchProductForDetailPage('voucher-spa-1h', 'pl');

    // React 19 cache() guarantees memoization within a single render scope.
    // In a unit-test harness without a React server render boundary, cache()
    // still memoizes by argument tuple within the same module-load scope.
    expect(mockedListProducts).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a?.id).toBe('prod_01');
  });

  it('does NOT collapse calls with different (handle, countryCode) keys', async () => {
    await fetchProductForDetailPage('voucher-massage', 'pl');
    await fetchProductForDetailPage('voucher-haircut', 'pl');
    await fetchProductForDetailPage('voucher-massage', 'en');

    // Three distinct argument tuples → three distinct fetches.
    expect(mockedListProducts).toHaveBeenCalledTimes(3);
  });

  it('returns null when product is not found', async () => {
    mockedListProducts.mockImplementationOnce(async () => ({
      response: { products: [], count: 0 },
      nextPage: null,
    }));

    const result = await fetchProductForDetailPage('nonexistent', 'pl');
    expect(result).toBeNull();
  });
});
