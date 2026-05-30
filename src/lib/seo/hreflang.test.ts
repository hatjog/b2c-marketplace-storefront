import { describe, expect, it } from 'vitest';

import { buildLocaleAlternates, buildLocaleSeoAlternates } from './hreflang';

const BASE = 'https://bonbeauty.example';

describe('buildLocaleAlternates', () => {
  const alt = buildLocaleAlternates(
    'pl',
    (loc) => `/${loc}/collections/skincare`,
    BASE
  );

  it('emits canonical BCP47 hreflang keys (pl-PL/en-US/uk-UA/de-DE) + x-default', () => {
    expect(Object.keys(alt.languages).sort()).toEqual(
      ['de-DE', 'en-US', 'pl-PL', 'uk-UA', 'x-default'].sort()
    );
  });

  it('does NOT emit bare storefront locale codes (regression: collections hreflang drift)', () => {
    // Pre-v1.10.0 the collections route emitted bare `pl/en/ua/de` keys instead of
    // canonical BCP47. Guard the whole class so any route reusing the SSOT stays canonical.
    for (const bare of ['pl', 'en', 'ua', 'de']) {
      expect(alt.languages).not.toHaveProperty(bare);
    }
  });

  it('maps the `ua` storefront locale to the `uk-UA` BCP47 key (not `ua-UA`)', () => {
    expect(alt.languages['uk-UA']).toBe(`${BASE}/ua/collections/skincare`);
  });

  it('points x-default at the default-locale (pl) URL', () => {
    expect(alt.languages['x-default']).toBe(`${BASE}/pl/collections/skincare`);
  });

  it('sets canonical to the active locale URL', () => {
    const de = buildLocaleAlternates('de', (loc) => `/${loc}/collections/skincare`, BASE);
    expect(de.canonical).toBe(`${BASE}/de/collections/skincare`);
  });

  it('returns relative paths when no baseUrl is supplied (metadataBase resolution)', () => {
    const rel = buildLocaleAlternates('pl', (loc) => `/${loc}/collections/skincare`);
    expect(rel.languages['pl-PL']).toBe('/pl/collections/skincare');
    expect(rel.languages['x-default']).toBe('/pl/collections/skincare');
  });
});

describe('buildLocaleSeoAlternates (PDP/category/seller routes)', () => {
  it('keeps BCP47 parity for product routes', () => {
    const alt = buildLocaleSeoAlternates(BASE, 'pl', 'products', 'serum-01');
    expect(alt.languages['uk-UA']).toBe(`${BASE}/ua/products/serum-01`);
    expect(alt.languages).not.toHaveProperty('ua');
    expect(alt.languages['x-default']).toBe(`${BASE}/pl/products/serum-01`);
  });
});
