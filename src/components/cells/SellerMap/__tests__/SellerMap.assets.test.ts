// @vitest-environment jsdom
/**
 * TF-65 — CSP-aware leaflet asset bundling guard.
 *
 * Verifies that Leaflet default marker icons resolve to local
 * `/leaflet-assets/` paths (same-origin) rather than any third-party
 * CDN. Combines:
 *
 *   (a) Runtime assertion against `L.Icon.Default.prototype.options`
 *       after applying the same `mergeOptions` call SellerMap performs.
 *       The constants are imported from `@/lib/map/leafletAssets` (NOT
 *       grepped from source) so refactors of the constants file are
 *       caught by the test.
 *   (b) Source-level guard against any CDN reference in the constants
 *       file and the SellerMap.tsx component file.
 *   (c) Regression guard: the `_getIconUrl` deletion and `mergeOptions`
 *       call must remain side-by-side in `SellerMap.tsx` so the
 *       Webpack/Turbopack workaround keeps working.
 *
 * Story: 4.3 (v1.10.0) — Marker assets bundled (Leaflet baseline);
 * originally introduced w v1.6.0 jako `v160-cleanup-31-csp-asset-bundling`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import L from 'leaflet';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getDefaultMarkerIcon, leafletAssets, leafletIconUrls } from '@/lib/map/leafletAssets';

const COMPONENT_DIR = resolve(__dirname, '..');
const SELLER_MAP_PATH = resolve(COMPONENT_DIR, 'SellerMap.tsx');
const LEAFLET_ASSETS_PATH = resolve(COMPONENT_DIR, '../../../lib/map/leafletAssets.ts');

const SELLER_MAP_SRC = readFileSync(SELLER_MAP_PATH, 'utf-8');
const LEAFLET_ASSETS_SRC = readFileSync(LEAFLET_ASSETS_PATH, 'utf-8');

const CDN_PATTERN = /(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/;
const LOCAL_ASSET_PREFIX = '/leaflet-assets/';

describe('SellerMap assets (TF-65) — supply-chain + CSP + GDPR', () => {
  // Snapshot the global Leaflet default options so the runtime mergeOptions
  // call in this test does not bleed into any other suite.
  const previousOptions = {
    ...((L.Icon.Default.prototype as unknown as { options?: Record<string, unknown> }).options ??
      {})
  };

  beforeAll(() => {
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions(leafletIconUrls);
  });

  afterAll(() => {
    (L.Icon.Default.prototype as { options?: unknown }).options = previousOptions;
  });

  it('exposes constants that all start with /leaflet-assets/ (same-origin)', () => {
    // AC2 + AC4 — same-origin guarantee at the constants layer.
    expect(leafletAssets.iconUrl).toMatch(/^\/leaflet-assets\//);
    expect(leafletAssets.iconRetinaUrl).toMatch(/^\/leaflet-assets\//);
    expect(leafletAssets.shadowUrl).toMatch(/^\/leaflet-assets\//);
    expect(leafletAssets.iconUrl.startsWith(LOCAL_ASSET_PREFIX)).toBe(true);
  });

  it('leafletIconUrls mirrors URL subset of leafletAssets (mergeOptions surface)', () => {
    // L-1 — mergeOptions side-effect ogranicza sie do URL-i; geometria zostaje
    // tylko w `leafletAssets` dla jawnych `new L.Icon(...)` instancji.
    expect(leafletIconUrls.iconUrl).toBe(leafletAssets.iconUrl);
    expect(leafletIconUrls.iconRetinaUrl).toBe(leafletAssets.iconRetinaUrl);
    expect(leafletIconUrls.shadowUrl).toBe(leafletAssets.shadowUrl);
    expect(Object.keys(leafletIconUrls).sort()).toEqual([
      'iconRetinaUrl',
      'iconUrl',
      'shadowUrl'
    ]);
  });

  it('runtime: L.Icon.Default options resolve to /leaflet-assets/ paths', () => {
    // AC5(a) — actually exercise the `mergeOptions` call against the live
    // leaflet package and assert on the resulting prototype options.
    const options = (L.Icon.Default.prototype as unknown as { options: Record<string, unknown> })
      .options;
    expect(options.iconUrl).toBe(leafletAssets.iconUrl);
    expect(options.iconRetinaUrl).toBe(leafletAssets.iconRetinaUrl);
    expect(options.shadowUrl).toBe(leafletAssets.shadowUrl);
  });

  it('runtime: merged options contain no third-party CDN reference', () => {
    // AC4 + AC5(b) — guard the runtime merged values directly.
    const options = (L.Icon.Default.prototype as unknown as { options: Record<string, unknown> })
      .options;
    for (const key of ['iconUrl', 'iconRetinaUrl', 'shadowUrl'] as const) {
      const value = options[key];
      expect(typeof value).toBe('string');
      expect(CDN_PATTERN.test(String(value))).toBe(false);
    }
  });

  it('getDefaultMarkerIcon(L) returns an Icon with local URLs', () => {
    // L-2 — kontrakt helpera dla Story 4.2 (jawne instancje markerow).
    const icon = getDefaultMarkerIcon(L);
    expect(icon.options.iconUrl).toBe(leafletAssets.iconUrl);
    expect(icon.options.iconRetinaUrl).toBe(leafletAssets.iconRetinaUrl);
    expect(icon.options.shadowUrl).toBe(leafletAssets.shadowUrl);
    expect(icon.options.iconSize).toEqual(leafletAssets.iconSize);
    expect(icon.options.iconAnchor).toEqual(leafletAssets.iconAnchor);
    expect(icon.options.popupAnchor).toEqual(leafletAssets.popupAnchor);
    expect(icon.options.shadowSize).toEqual(leafletAssets.shadowSize);
  });

  it('source: SellerMap.tsx contains no CDN reference', () => {
    // AC2 — defensive grep at the component layer.
    expect(CDN_PATTERN.test(SELLER_MAP_SRC)).toBe(false);
  });

  it('source: leafletAssets.ts contains no CDN reference', () => {
    // AC2 — defensive grep at the constants layer (covers refactors that
    // move the URLs out of SellerMap.tsx).
    expect(CDN_PATTERN.test(LEAFLET_ASSETS_SRC)).toBe(false);
  });

  it('regression: `_getIconUrl` deletion immediately precedes mergeOptions', () => {
    // Locks the Webpack/Turbopack workaround ordering — both lines must
    // remain together so the side-effect order survives refactors.
    const ordering =
      /delete \(L\.Icon\.Default\.prototype as \{ _getIconUrl\?: unknown \}\)\._getIconUrl;\s*\nL\.Icon\.Default\.mergeOptions\(leafletIconUrls\);/;
    expect(ordering.test(SELLER_MAP_SRC)).toBe(true);
  });
});
