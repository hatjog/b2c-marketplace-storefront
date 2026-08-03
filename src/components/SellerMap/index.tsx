'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { SellerMapSkeleton } from './SellerMapSkeleton';
import type { SellerMapProps } from './SellerMap.client';

// F-07: `dynamic({ loading })` nie zna props → hardcoded skeleton="list" powoduje CLS na mode=mini/detail/landing.
// Rozwiązanie: dynamic bez loading, a wrapper renderuje SellerMapSkeleton mode-aware do czasu hydratacji klienta.
const SellerMapClient = dynamic<SellerMapProps>(
  () => import('./SellerMap.client').then(mod => mod.SellerMap),
  {
    ssr: false,
    loading: () => null
  }
);

export type { SellerMapProps, SellerMapSeller } from './SellerMap.client';
export type { SellerMapMode } from './modes';
export { buildMapDeepLink } from './deepLink';
export { SELLER_MAP_MODES, getSellerMapModeConfig } from './modes';
export { SellerMapSkeleton } from './SellerMapSkeleton';

export function SellerMap(props: SellerMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <SellerMapSkeleton mode={props.mode} />;
  }

  return <SellerMapClient {...props} />;
}

export default SellerMap;
