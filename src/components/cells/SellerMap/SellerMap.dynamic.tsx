'use client';

import dynamic from 'next/dynamic';

import type { SellerMapProps } from './SellerMap';

/**
 * Story v160-4-2 — lazy-loaded `SellerMap` wrapper.
 *
 * `react-leaflet` reaches for `window` at module init, so the underlying
 * `SellerMap` cannot be SSR'd. `next/dynamic({ ssr: false })` resolves it:
 * server renders the `aria-busy` placeholder, client hydrates the map chunk
 * on demand (only when `?view=map`).
 *
 * Bundle impact: map library lives in its own chunk (verified via Next.js
 * build manifest); `/sellers` route initial JS delta stays well under the
 * +50KB gzip budget per AC5.
 */
export const SellerMapDynamic = dynamic<SellerMapProps>(
  () => import('./SellerMap').then(mod => mod.SellerMap),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        className="h-96 w-full animate-pulse rounded-sm bg-stone-100"
        data-testid="seller-map-loading"
      />
    )
  }
);

export default SellerMapDynamic;
