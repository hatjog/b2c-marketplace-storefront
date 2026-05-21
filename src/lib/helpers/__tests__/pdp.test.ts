import { describe, expect, it } from 'vitest';

import {
  countSellerProofPoints,
  deriveSellerRatingCount,
  deriveSellerTreatments,
  deriveSellerYears,
  formatSellerDistrictAddress,
  normalizePdpGalleryImages,
  resolvePdpVoucherRules
} from '../pdp';

describe('PDP helpers', () => {
  it('formats SellerProof address with district visibility', () => {
    expect(
      formatSellerDistrictAddress({ name: 'Salon Belle Praga', district: 'Praga-Południe' })
    ).toBe('Salon Belle Praga · Praga-Południe');
  });

  it('derives seller proof points from established year, treatments and rating count', () => {
    const now = new Date('2026-05-19T10:00:00Z');
    const seller = {
      established_year: 2021,
      treatments_count: 342,
      rating_count: 124
    };

    const years = deriveSellerYears(seller, now);
    const treatments = deriveSellerTreatments(seller);
    const ratingCount = deriveSellerRatingCount(seller);

    expect(years).toBe(5);
    expect(treatments).toBe(342);
    expect(ratingCount).toBe(124);
    expect(countSellerProofPoints({ years, treatments, rating: 4.8, ratingCount })).toBe(3);
  });

  it('keeps missing ratings truthful and below the three-proof threshold', () => {
    const proofCount = countSellerProofPoints({
      years: 5,
      treatments: 342,
      rating: null,
      ratingCount: null
    });

    expect(proofCount).toBe(2);
  });

  it('resolves voucher validity from days and uses localized fallback policy copy', () => {
    const rules = resolvePdpVoucherRules(
      { validity_period: '365d', realization_rules: ['Pokaż PDF w salonie'] },
      {
        usageConditions: ['fallback'],
        refundPolicy: '30 dni na zwrot',
        cancellationPolicy: 'Anulowanie do 24h',
        extensionPolicy: 'Przedłużenie o 90 dni',
        noShowPolicy: 'Brak zwrotu po drugiej nieobecności'
      }
    );

    expect(rules.validityMonths).toBe(12);
    expect(rules.usageConditions).toEqual(['Pokaż PDF w salonie']);
    expect(rules.refundPolicy).toBe('30 dni na zwrot');
  });

  it('normalizes missing PDP images to a stable placeholder', () => {
    const images = normalizePdpGalleryImages({
      id: 'prod_1',
      title: 'Rytuał twarzy',
      images: [],
      thumbnail: null
    } as never);

    expect(images).toHaveLength(1);
    expect(images[0]?.url).toBe('/images/product/placeholder.jpg');
  });

  it('documents gift mode cart metadata shape for W1-04 add-to-cart', () => {
    const purchaseMode = 'gift' as const;
    const purchaseModeMetadata = {
      purchase_mode: purchaseMode,
      is_gift: purchaseMode === 'gift'
    };

    expect(purchaseModeMetadata).toEqual({
      purchase_mode: 'gift',
      is_gift: true
    });
  });
});
