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
 *       The constants are imported from `../leafletAssets.ts` (NOT
 *       grepped from source) so refactors of the constants file are
 *       caught by the test.
 *   (b) Source-level guard against any CDN reference in the constants
 *       file and the SellerMap.tsx component file.
 *   (c) Regression guard: the `_getIconUrl` deletion and `mergeOptions`
 *       call must remain side-by-side in `SellerMap.tsx` so the
 *       Webpack/Turbopack workaround keeps working.
 *
 * Story: v160-cleanup-31-csp-asset-bundling
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import L from 'leaflet';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  LEAFLET_DEFAULT_ICON_OPTIONS,
  LEAFLET_ICON_RETINA_URL,
  LEAFLET_ICON_URL,
  LEAFLET_SHADOW_URL,
} from '../leafletAssets';

const COMPONENT_DIR = resolve(__dirname, '..');
const SELLER_MAP_PATH = resolve(COMPONENT_DIR, 'SellerMap.tsx');
const LEAFLET_ASSETS_PATH = resolve(COMPONENT_DIR, 'leafletAssets.ts');

const SELLER_MAP_SRC = readFileSync(SELLER_MAP_PATH, 'utf-8');
const LEAFLET_ASSETS_SRC = readFileSync(LEAFLET_ASSETS_PATH, 'utf-8');

const CDN_PATTERN = /(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/;
const LOCAL_ASSET_PREFIX = '/leaflet-assets/';

describe('SellerMap assets (TF-65) — supply-chain + CSP + GDPR', () => {
  // Snapshot the global Leaflet default options so the runtime mergeOptions
  // call in this test does not bleed into any other suite.
  const previousOptions = { ...(L.Icon.Default.prototype as { options?: unknown }).options };

  beforeAll(() => {
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions(LEAFLET_DEFAULT_ICON_OPTIONS);
  });

  afterAll(() => {
    (L.Icon.Default.prototype as { options?: unknown }).options = previousOptions;
  });

  it('exposes constants that all start with /leaflet-assets/ (same-origin)', () => {
    // AC2 + AC4 — same-origin guarantee at the constants layer.
    expect(LEAFLET_ICON_URL).toMatch(/^\/leaflet-assets\//);
    expect(LEAFLET_ICON_RETINA_URL).toMatch(/^\/leaflet-assets\//);
    expect(LEAFLET_SHADOW_URL).toMatch(/^\/leaflet-assets\//);
    expect(LEAFLET_ICON_URL.startsWith(LOCAL_ASSET_PREFIX)).toBe(true);
  });

  it('runtime: L.Icon.Default options resolve to /leaflet-assets/ paths', () => {
    // AC5(a) — actually exercise the `mergeOptions` call against the live
    // leaflet package and assert on the resulting prototype options.
    const options = (
      L.Icon.Default.prototype as { options: Record<string, unknown> }
    ).options;
    expect(options.iconUrl).toBe(LEAFLET_ICON_URL);
    expect(options.iconRetinaUrl).toBe(LEAFLET_ICON_RETINA_URL);
    expect(options.shadowUrl).toBe(LEAFLET_SHADOW_URL);
  });

  it('runtime: merged options contain no third-party CDN reference', () => {
    // AC4 + AC5(b) — guard the runtime merged values directly.
    const options = (
      L.Icon.Default.prototype as { options: Record<string, unknown> }
    ).options;
    for (const key of ['iconUrl', 'iconRetinaUrl', 'shadowUrl'] as const) {
      const value = options[key];
      expect(typeof value).toBe('string');
      expect(CDN_PATTERN.test(String(value))).toBe(false);
    }
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
    const ordering = /delete \(L\.Icon\.Default\.prototype as \{ _getIconUrl\?: unknown \}\)\._getIconUrl;\s*\nL\.Icon\.Default\.mergeOptions\(LEAFLET_DEFAULT_ICON_OPTIONS\);/;
    expect(ordering.test(SELLER_MAP_SRC)).toBe(true);
  });
});
