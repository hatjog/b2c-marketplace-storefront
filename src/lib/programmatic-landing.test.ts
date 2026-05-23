import { describe, expect, it } from 'vitest';

import {
  getProgrammaticLandingData,
  PROGRAMMATIC_LOCATIONS,
  PROGRAMMATIC_OFFERS,
  slugifyProgrammaticPart
} from './programmatic-landing';

describe('programmatic landing read model', () => {
  it('normalizes slugs with Polish diacritics', () => {
    expect(slugifyProgrammaticPart('Praga-Południe')).toBe('praga-poludnie');
    expect(slugifyProgrammaticPart('Masaż')).toBe('masaz');
  });

  it('provides city and district locations with geo coordinates', () => {
    const warszawa = PROGRAMMATIC_LOCATIONS.find(location => location.slug === 'warszawa');
    const powisle = PROGRAMMATIC_LOCATIONS.find(location => location.slug === 'powisle');

    expect(warszawa?.geo.latitude).toBeGreaterThan(52);
    expect(warszawa?.geo.longitude).toBeGreaterThan(20);
    expect(powisle?.district).toBe('Powiśle');
  });

  it('provides offer labels for all storefront locales', () => {
    const massage = PROGRAMMATIC_OFFERS.find(offer => offer.slug === 'masaz');

    expect(massage?.labels.pl).toBe('Masaż');
    expect(massage?.labels.en).toBe('Massage');
    expect(massage?.labels.ua).toBe('Масаж');
    expect(massage?.labels.de).toBe('Massage');
  });

  it('filters local salons by location and offer without leaking other districts', () => {
    const data = getProgrammaticLandingData({
      locale: 'pl',
      locationSlug: 'powisle',
      offerSlug: 'masaz'
    });

    expect(data).not.toBeNull();
    expect(data?.salons).toHaveLength(1);
    expect(data?.salons[0]?.district).toBe('Powiśle');
    expect(data?.featuredOffers.length).toBeGreaterThan(0);
    expect(data?.relatedLocations.some(location => location.slug === 'powisle')).toBe(false);
  });

  it('returns null for invalid location or offer slugs', () => {
    expect(
      getProgrammaticLandingData({
        locale: 'pl',
        locationSlug: 'unknown',
        offerSlug: 'masaz'
      })
    ).toBeNull();

    expect(
      getProgrammaticLandingData({
        locale: 'pl',
        locationSlug: 'warszawa',
        offerSlug: 'unknown'
      })
    ).toBeNull();
  });

  it('excludes salons from a different market (cross-market isolation)', () => {
    // All SELLER_DIRECTORY_FIXTURES have marketId='bonbeauty'.
    // Requesting with marketId='othermarket' must produce empty salons and featuredOffers
    // for a location/offer combination known to return results for 'bonbeauty'.
    const bonbeautyData = getProgrammaticLandingData({
      locale: 'pl',
      locationSlug: 'powisle',
      offerSlug: 'masaz',
      marketId: 'bonbeauty'
    });

    const otherMarketData = getProgrammaticLandingData({
      locale: 'pl',
      locationSlug: 'powisle',
      offerSlug: 'masaz',
      marketId: 'othermarket'
    });

    // bonbeauty should find at least one salon (Loft Beauty Powiśle)
    expect(bonbeautyData).not.toBeNull();
    expect(bonbeautyData?.salons.length).toBeGreaterThan(0);

    // othermarket has no fixtures, so salons and featuredOffers must be empty
    expect(otherMarketData).not.toBeNull();
    expect(otherMarketData?.salons).toHaveLength(0);
    expect(otherMarketData?.featuredOffers).toHaveLength(0);
    expect(otherMarketData?.relatedLocations).toHaveLength(0);

    // Confirm no bonbeauty salon handles leak into othermarket result
    const bonbeautyHandles = bonbeautyData?.salons.map(s => s.handle) ?? [];
    const otherHandles = otherMarketData?.salons.map(s => s.handle) ?? [];
    expect(otherHandles.some(h => bonbeautyHandles.includes(h))).toBe(false);
  });
});