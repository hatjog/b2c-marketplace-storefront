/**
 * TF-65 — CSP-aware leaflet asset bundling guard
 *
 * Verifies that SellerMap.tsx uses local `/leaflet-assets/` paths for
 * Leaflet default marker icons instead of third-party `unpkg.com` URLs.
 *
 * These tests run in node environment (no DOM required) — they read the
 * source file as text and assert the icon URL constants to avoid any
 * dependency on react-leaflet's window requirement in jsdom.
 *
 * Story: v160-cleanup-31-csp-asset-bundling
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SELLER_MAP_PATH = resolve(
  __dirname,
  '../SellerMap.tsx'
);

const SOURCE = readFileSync(SELLER_MAP_PATH, 'utf-8');

describe('SellerMap assets (TF-65) — supply-chain + CSP + GDPR', () => {
  it('does NOT reference unpkg.com in mergeOptions', () => {
    // AC2: no unpkg.com in source (even in comments we check — none should be there post-fix)
    const unpkgMatches = SOURCE.match(/unpkg\.com/g);
    expect(
      unpkgMatches,
      'Expected 0 occurrences of unpkg.com in SellerMap.tsx'
    ).toBeNull();
  });

  it('uses /leaflet-assets/ path for iconUrl', () => {
    // AC2 + AC5(a): iconUrl points to local path
    expect(SOURCE).toContain("iconUrl: '/leaflet-assets/marker-icon.png'");
  });

  it('uses /leaflet-assets/ path for iconRetinaUrl', () => {
    // AC2 + AC5(a): iconRetinaUrl points to local path
    expect(SOURCE).toContain("iconRetinaUrl: '/leaflet-assets/marker-icon-2x.png'");
  });

  it('uses /leaflet-assets/ path for shadowUrl', () => {
    // AC2 + AC5(a): shadowUrl points to local path
    expect(SOURCE).toContain("shadowUrl: '/leaflet-assets/marker-shadow.png'");
  });

  it('does NOT reference any external CDN for marker icons', () => {
    // AC4: broader guard — no cdn.jsdelivr.net, no cdnjs.cloudflare.com, no unpkg.com
    const cdnPattern = /(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/;
    expect(
      cdnPattern.test(SOURCE),
      'Expected no external CDN references for marker icons in SellerMap.tsx'
    ).toBe(false);
  });

  it('retains the _getIconUrl deletion for Webpack/Turbopack compat', () => {
    // Regression guard: the delete statement must not be removed (still needed for bundler fix)
    expect(SOURCE).toContain('delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl');
  });
});
