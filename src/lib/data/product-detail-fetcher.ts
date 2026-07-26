'use server';

import { cache } from 'react';

import type { StorefrontLocaleSlug } from '@/lib/sdk/locale-interceptor';

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
 *
 * v1.14.0 Story 1.2 (AD-1, AC1/T4):
 *  - `cache()` Reacta ZOSTAJE jako request-dedupe NAD `unstable_cache` —
 *    to dwie różne warstwy (dedupe w obrębie jednego renderu vs. persystentny
 *    Data Cache między requestami), nie alternatywy;
 *  - `forceCache: true` ZNIKA: cache katalogu żyje teraz w `unstable_cache`
 *    z locale w kluczu, a nie w `force-cache` na fetchu z nagłówkiem locale
 *    (to był dokładnie mechanizm przecieku PL→UA — zakaz AD-1);
 *  - `locale` przychodzi Z ROUTE'U i jest częścią klucza `cache()` ORAZ trafia
 *    jawnie do klucza `unstable_cache` w `listProducts`. Bez tego dwa PDP w
 *    różnych językach dedupe'owałyby się do jednej odpowiedzi.
 *
 * ZAKRES: to jest wyłącznie przepływ locale do klucza cache. Reland
 * lokalizowanego contentu PDP należy do Story 1.3.
 */
export const fetchProductForDetailPage = cache(async (
  handle: string,
  countryCode: string,
  locale: StorefrontLocaleSlug,
) => {
  const { response } = await listProducts({
    countryCode,
    queryParams: { handle: [handle], limit: 1 },
    includeSellerContext: true,
    locale,
  });

  return response.products[0] ?? null;
});
