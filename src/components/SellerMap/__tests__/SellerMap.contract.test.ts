import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SELLER_MAP_MODES } from '../modes';

const COMPONENT_DIR = resolve(__dirname, '..');
const CLIENT_SRC = readFileSync(resolve(COMPONENT_DIR, 'SellerMap.client.tsx'), 'utf-8');
const CSS_SRC = readFileSync(resolve(COMPONENT_DIR, 'SellerMap.module.css'), 'utf-8');
// Story 7.5: attribution/tile-source przeniesione do współdzielonego SSOT
// `tileSource.ts` (konsolidacja mode-aware MapTiler dla obu map).
const TILE_SRC = readFileSync(resolve(COMPONENT_DIR, 'tileSource.ts'), 'utf-8');

describe('SellerMap contract', () => {
  it('ma cztery wymagane mode oraz auto-zoom nie większy niż poziom dzielnicy', () => {
    expect(Object.keys(SELLER_MAP_MODES).sort()).toEqual([
      'detail',
      'landing',
      'list',
      'mini'
    ]);

    for (const config of Object.values(SELLER_MAP_MODES)) {
      expect(config.maxAutoZoom).toBeLessThanOrEqual(14);
    }
  });

  it('blokuje zoom controls w trybie mini i lazy mount w trybie landing', () => {
    expect(SELLER_MAP_MODES.mini.zoomControl).toBe(false);
    expect(SELLER_MAP_MODES.mini.scrollWheelZoom).toBe(false);
    expect(SELLER_MAP_MODES.landing.lazyMount).toBe(true);
  });

  it('deklaruje responsywne proporcje 1:1, 4:3 i 16:9', () => {
    expect(CSS_SRC).toContain('aspect-ratio: 1 / 1');
    expect(CSS_SRC).toContain('aspect-ratio: 4 / 3');
    expect(CSS_SRC).toContain('aspect-ratio: 16 / 9');
  });

  it('wymusza touch target 44px dla zoom controls oraz markerów', () => {
    expect(CSS_SRC).toContain('width: 44px');
    expect(CSS_SRC).toContain('height: 44px');
    expect(CSS_SRC).toContain('min-width: 44px');
    expect(CSS_SRC).toContain('min-height: 44px');
  });

  it('zawiera MapTiler i OpenStreetMap attribution (tileSource SSOT) oraz nie renderuje raw coords w popupie', () => {
    expect(TILE_SRC).toContain('MapTiler');
    expect(TILE_SRC).toContain('OpenStreetMap');
    expect(CLIENT_SRC).not.toContain('{seller.lat}');
    expect(CLIENT_SRC).not.toContain('{seller.lng}');
  });

  it('udostępnia focusowalny kontener mapy i obsługę klawiatury Leaflet', () => {
    expect(CLIENT_SRC).toContain('tabIndex={0}');
    expect(CLIENT_SRC).toContain('keyboard');
    expect(CLIENT_SRC).toContain('keyboardPanDelta={80}');
  });
});
