import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENT_DIR = resolve(__dirname, '..');
const SELLER_MAP_PATH = resolve(COMPONENT_DIR, 'SellerMap.tsx');
const SELLER_MAP_SRC = readFileSync(SELLER_MAP_PATH, 'utf-8');

describe('SellerMap cluster integration smoke', () => {
  it('imports Leaflet.markercluster and its local node_modules CSS assets', () => {
    expect(SELLER_MAP_SRC).toContain("import 'leaflet.markercluster';");
    expect(SELLER_MAP_SRC).toContain("import 'leaflet.markercluster/dist/MarkerCluster.css';");
    expect(SELLER_MAP_SRC).toContain(
      "import 'leaflet.markercluster/dist/MarkerCluster.Default.css';"
    );
    expect(SELLER_MAP_SRC).not.toMatch(/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/);
  });

  it('renders clusters only through resolveClusterEnabled', () => {
    expect(SELLER_MAP_SRC).toContain('const clusterEnabled = resolveClusterEnabled({');
    expect(SELLER_MAP_SRC).toContain('sellersCount: validSellers.length');
    expect(SELLER_MAP_SRC).toContain('clusterEnabled ? (');
    expect(SELLER_MAP_SRC).toContain('<ClusteredSellerMarkers');
  });

  it('keeps raw Marker rendering for the non-cluster path', () => {
    expect(SELLER_MAP_SRC).toContain('validSellers.map(seller => (');
    expect(SELLER_MAP_SRC).toContain('<Marker');
    expect(SELLER_MAP_SRC).toContain('<Popup>');
  });

  it('adds the cluster a11y label and expected cluster options', () => {
    expect(SELLER_MAP_SRC).toContain("t('clusterAriaLabel', { count })");
    expect(SELLER_MAP_SRC).toContain('role="button"');
    expect(SELLER_MAP_SRC).toContain('tabindex="0"');
    expect(SELLER_MAP_SRC).toContain('...DEFAULT_CLUSTER_OPTIONS');
  });
});
