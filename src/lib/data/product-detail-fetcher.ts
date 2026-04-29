'use server';

import { cache } from 'react';

import { listProducts } from './products';

/**
 * D-09 (v1.4.0 carry-over): React 19 cache() wrapper around the PDP fetcher.
 *
 * The product detail route renders TWO server components that both need the
 * full product payload:
 *   - app/[locale]/(main)/products/[handle]/page.tsx — JSON-LD + metadata
 *   - components/sections/ProductDetailsPage.tsx     — gallery + details + sticky CTA
 *
 * Without `cache()`, both components issue the same listProducts request
 * during a single render, doubling backend load and PDP TTFB. With this
 * shared cache(), subsequent calls within the same React render tree return
 * the memoized result.
 *
 * NFR-PERF-3 signal: zero duplicate fetches per PDP render (verified via
 * `__tests__/product-detail-fetcher.test.ts` invocation count assertion).
 */
export const fetchProductForDetailPage = cache(async (
  handle: string,
  countryCode: string,
) => {
  const { response } = await listProducts({
    countryCode,
    queryParams: { handle: [handle], limit: 1 },
    forceCache: true,
    includeSellerContext: true,
  });

  return response.products[0] ?? null;
});
