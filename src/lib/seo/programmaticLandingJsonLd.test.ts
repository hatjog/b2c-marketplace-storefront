import { describe, expect, it } from 'vitest';

import { getProgrammaticLandingData } from '@/lib/programmatic-landing';

import { buildProgrammaticLandingJsonLd, serializeJsonLd } from './programmaticLandingJsonLd';

describe('programmatic landing JSON-LD', () => {
  it('builds one graph with Place and OfferCatalog and no undefined fields', () => {
    const data = getProgrammaticLandingData({
      locale: 'pl',
      locationSlug: 'warszawa',
      offerSlug: 'masaz'
    });

    expect(data).not.toBeNull();
    const jsonLd = buildProgrammaticLandingJsonLd(
      data!,
      'https://storefront.test/pl/l/warszawa/masaz'
    ) as { '@context': string; '@graph': Array<Record<string, unknown>> };

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@graph']).toHaveLength(2);
    expect(jsonLd['@graph'][0]?.['@type']).toBe('Place');
    expect(jsonLd['@graph'][0]?.geo).toMatchObject({
      '@type': 'GeoCoordinates'
    });
    expect(jsonLd['@graph'][1]?.['@type']).toBe('OfferCatalog');
    expect(JSON.stringify(jsonLd)).not.toContain('undefined');
  });

  it('escapes JSON-LD serialization for script context', () => {
    const serialized = serializeJsonLd({
      '@context': 'https://schema.org',
      name: '<script>alert("x")</script> & test'
    });

    expect(serialized).toContain('\\u003cscript');
    expect(serialized).toContain('\\u0026');
    expect(serialized).not.toContain('<script>');
  });
});