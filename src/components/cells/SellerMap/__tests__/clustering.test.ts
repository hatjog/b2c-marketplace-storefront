import { describe, expect, it } from 'vitest';

import {
  CLUSTER_THRESHOLD,
  DEFAULT_CLUSTER_OPTIONS,
  resolveClusterEnabled,
  resolveClusterMode,
  type SellerMapClusterMode,
  type SellerMapMode
} from '../clustering';

const modes: SellerMapMode[] = ['list', 'detail', 'mini', 'landing'];
const clusterModes: SellerMapClusterMode[] = ['auto', 'on', 'off'];
const sellerCounts = [10, CLUSTER_THRESHOLD, 100];

function expectedClusterEnabled(
  mode: SellerMapMode,
  clusterMode: SellerMapClusterMode,
  sellersCount: number
) {
  if (mode === 'detail' || mode === 'mini') {
    return false;
  }

  if (clusterMode === 'on') {
    return true;
  }

  if (clusterMode === 'off') {
    return false;
  }

  return sellersCount > CLUSTER_THRESHOLD;
}

describe('SellerMap clustering resolver', () => {
  it.each(
    modes.flatMap(mode =>
      clusterModes.flatMap(clusterMode =>
        sellerCounts.map(sellersCount => [mode, clusterMode, sellersCount] as const)
      )
    )
  )('resolves mode=%s clusterMode=%s sellersCount=%d', (mode, clusterMode, sellersCount) => {
    expect(resolveClusterEnabled({ mode, clusterMode, sellersCount })).toBe(
      expectedClusterEnabled(mode, clusterMode, sellersCount)
    );
  });

  it('defaults list and landing to auto', () => {
    expect(resolveClusterMode({ mode: 'list' })).toBe('auto');
    expect(resolveClusterMode({ mode: 'landing' })).toBe('auto');
  });

  it('forces detail and mini to off even when consumers pass on', () => {
    expect(resolveClusterMode({ mode: 'detail', clusterMode: 'on' })).toBe('off');
    expect(resolveClusterMode({ mode: 'mini', clusterMode: 'on' })).toBe('off');
    expect(resolveClusterEnabled({ mode: 'detail', clusterMode: 'on', sellersCount: 100 })).toBe(
      false
    );
    expect(resolveClusterEnabled({ mode: 'mini', clusterMode: 'on', sellersCount: 100 })).toBe(
      false
    );
  });

  it('uses the neighborhood-friendly default Leaflet.markercluster config', () => {
    expect(DEFAULT_CLUSTER_OPTIONS).toEqual({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true
    });
  });
});
