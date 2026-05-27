export const CLUSTER_THRESHOLD = 50;

export type SellerMapMode = 'list' | 'detail' | 'mini' | 'landing';
export type SellerMapClusterMode = 'auto' | 'on' | 'off';

export const SELLER_MAP_MODES: Record<SellerMapMode, { clusterMode: SellerMapClusterMode }> = {
  list: { clusterMode: 'auto' },
  detail: { clusterMode: 'off' },
  mini: { clusterMode: 'off' },
  landing: { clusterMode: 'auto' }
};

export const DEFAULT_CLUSTER_OPTIONS = {
  maxClusterRadius: 60,
  disableClusteringAtZoom: 16,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  chunkedLoading: true
} as const;

interface ResolveClusterEnabledArgs {
  mode: SellerMapMode;
  clusterMode?: SellerMapClusterMode;
  sellersCount: number;
}

export function resolveClusterMode({
  mode,
  clusterMode
}: Pick<ResolveClusterEnabledArgs, 'mode' | 'clusterMode'>): SellerMapClusterMode {
  if (mode === 'detail' || mode === 'mini') {
    return 'off';
  }

  return clusterMode ?? SELLER_MAP_MODES[mode].clusterMode;
}

export function resolveClusterEnabled({
  mode,
  clusterMode,
  sellersCount
}: ResolveClusterEnabledArgs): boolean {
  const resolvedMode = resolveClusterMode({ mode, clusterMode });

  if (resolvedMode === 'on') {
    return true;
  }

  if (resolvedMode === 'off') {
    return false;
  }

  return sellersCount > CLUSTER_THRESHOLD;
}
