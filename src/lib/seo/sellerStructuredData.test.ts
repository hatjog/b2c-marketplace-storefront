import { describe, expect, it } from 'vitest';

import type { SellerProps } from '@/types/seller';

import { assessSellerStructuredData } from './sellerStructuredData';

const baseSeller: SellerProps = {
  id: 'seller-1',
  name: 'Salon Test',
  handle: 'salon-test',
  description: 'Opis salonu',
  photo: 'https://example.com/photo.jpg',
  tax_id: 'PL1234567890',
  created_at: '2024-01-01T00:00:00.000Z',
  address_line: 'ul. Testowa 1',
  city: 'Warszawa',
  district: 'Śródmieście',
  postal_code: '00-001',
  country_code: 'pl',
  phone: '+48 500 600 700',
  lat: 52.2297,
  lng: 21.0122,
  opening_hours: {
    Mo: { open: '09:00', close: '18:00' }
  },
  reviews: [{ rating: 5 }, { rating: 4 }]
};

describe('assessSellerStructuredData', () => {
  it('builds LocalBusiness JSON-LD when required fields are present', () => {
    const result = assessSellerStructuredData(baseSeller);

    expect(result.canIndex).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.jsonLd).toMatchObject({
      '@type': 'LocalBusiness',
      name: 'Salon Test',
      telephone: '+48 500 600 700'
    });
    expect(result.jsonLd?.aggregateRating).toMatchObject({
      ratingValue: 4.5,
      reviewCount: 2
    });
  });

  it('returns noindex when phone or geo are missing from LocalBusiness data', () => {
    const result = assessSellerStructuredData({
      ...baseSeller,
      phone: undefined,
      lat: null,
      lng: null
    });

    expect(result.canIndex).toBe(false);
    expect(result.jsonLd).toBeNull();
    expect(result.missingRequired).toEqual(['telephone', 'geo']);
  });

  it('returns noindex assessment instead of throwing when address fields are missing', () => {
    const result = assessSellerStructuredData({
      ...baseSeller,
      address_line: undefined,
      city: undefined
    });

    expect(result.canIndex).toBe(false);
    expect(result.jsonLd).toBeNull();
    expect(result.missingRequired).toEqual(['address.streetAddress', 'address.addressLocality']);
  });

  it('emits REGON and KRS as schema.org identifier PropertyValue array (Story 6.2 I-1)', () => {
    const result = assessSellerStructuredData({
      ...baseSeller,
      regon: '123456785',
      krs: '0000123456'
    });

    expect(result.canIndex).toBe(true);
    expect(result.jsonLd?.identifier).toEqual([
      { '@type': 'PropertyValue', propertyID: 'REGON', value: '123456785' },
      { '@type': 'PropertyValue', propertyID: 'KRS', value: '0000123456' }
    ]);
  });

  it('skips identifier array entirely when REGON and KRS are absent', () => {
    const result = assessSellerStructuredData(baseSeller);
    expect(result.canIndex).toBe(true);
    expect(result.jsonLd?.identifier).toBeUndefined();
  });

  it('emits only REGON identifier when KRS is missing (KRS is conditional per AC12)', () => {
    const result = assessSellerStructuredData({
      ...baseSeller,
      regon: '987654321',
      krs: null
    });

    expect(result.canIndex).toBe(true);
    expect(result.jsonLd?.identifier).toEqual([
      { '@type': 'PropertyValue', propertyID: 'REGON', value: '987654321' }
    ]);
  });
});
