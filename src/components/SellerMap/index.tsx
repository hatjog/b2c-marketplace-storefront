import dynamic from 'next/dynamic';

import { SellerMapSkeleton } from './SellerMapSkeleton';
import type { SellerMapProps } from './SellerMap.client';

const SellerMapClient = dynamic<SellerMapProps>(
  () => import('./SellerMap.client').then(mod => mod.SellerMap),
  {
    ssr: false,
    loading: () => <SellerMapSkeleton mode="list" />
  }
);

export type { SellerMapProps, SellerMapSeller } from './SellerMap.client';
export type { SellerMapMode } from './modes';
export { buildMapDeepLink } from './deepLink';
export { SELLER_MAP_MODES, getSellerMapModeConfig } from './modes';

export function SellerMap(props: SellerMapProps) {
  return <SellerMapClient {...props} />;
}

export default SellerMap;
