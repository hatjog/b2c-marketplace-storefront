'use client';

import dynamic from 'next/dynamic';

import type { DirectionsBlockProps } from './DirectionsBlock';

/**
 * Story v160-4-5 — lazy-loaded `DirectionsBlock` wrapper.
 *
 * `DirectionsBlock` itself is `'use client'` ale transitively imports
 * `SellerMap` (cell) which pulls `react-leaflet` + Leaflet at module init —
 * those access `window` and crash w SSR. Rather than relying solely on the
 * inner `SellerMap` dynamic wrapper (which IS already SSR-safe), we
 * additionally gate the entire block z `dynamic({ ssr: false })` aby:
 *  - Server render = `aria-busy="true"` placeholder (no Leaflet chunk pulled).
 *  - Client hydration = single bundled chunk dla całego organism.
 *  - Build manifest verify: react-leaflet stays in separate chunk shared z
 *    `/sellers?view=map` route (Story 4.2 lazy chunk reused — NOT duplicated).
 */
export const DirectionsBlockDynamic = dynamic<DirectionsBlockProps>(
  () => import('./DirectionsBlock').then(mod => mod.DirectionsBlock),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        className="h-80 w-full animate-pulse rounded-sm bg-stone-100"
        data-testid="directions-block-loading"
      />
    )
  }
);

export default DirectionsBlockDynamic;
