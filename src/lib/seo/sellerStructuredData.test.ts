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
  postal_code: '00-001',
  country_code: 'pl',
  phone: '+48 500 600 700',
  lat: 52.2297,
  lng: 21.0122,
  opening_hours: {
    Mo: { open: '09:00', close: '18:00' }
  },
  reviews: [
    { rating: 5 },
    { rating: 4 }
  ]
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

  it('returns noindex assessment instead of throwing when required fields are missing', () => {
    const result = assessSellerStructuredData({
      ...baseSeller,
      phone: undefined,
      lat: null,
      lng: null
    });

    expect(result.canIndex).toBe(false);
    expect(result.jsonLd).toBeNull();
    expect(result.missingRequired).toEqual(['telephone', 'geo.latitude', 'geo.longitude']);
  });
});
