/**
 * voucher-copy.ts unit tests — v1.7.0 Story 2.3
 *
 * Tests: formatVoucherPrice, resolveValidityWording, deriveVoucherClarityVariant,
 * deriveSellerProofVariant
 */

import { describe, expect, it } from 'vitest';
import {
  formatVoucherPrice,
  resolveValidityWording,
  deriveVoucherClarityVariant,
  deriveSellerProofVariant,
} from '../voucher-copy';

describe('formatVoucherPrice', () => {
  it('formats PLN minor units to display string', () => {
    const result = formatVoucherPrice(25000, 'PLN', 'pl');
    // Should contain 250 and PLN currency indicator
    expect(result).toContain('250');
  });

  it('handles edge case: 0 amount', () => {
    const result = formatVoucherPrice(0, 'PLN', 'pl');
    expect(result).toContain('0');
  });

  it('falls back gracefully for unsupported currency', () => {
    const result = formatVoucherPrice(10000, 'XYZ', 'pl');
    // Should not throw; returns a string containing the formatted amount
    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });
});

describe('resolveValidityWording', () => {
  it('returns gpMetaValidityPeriod when present (product wins)', () => {
    expect(resolveValidityWording('12 miesięcy', 'Ważny 6 miesięcy')).toBe('12 miesięcy');
  });

  it('falls back to marketDefaultValidityInfo when gpMeta absent', () => {
    expect(resolveValidityWording(null, 'Ważny 6 miesięcy')).toBe('Ważny 6 miesięcy');
  });

  it('returns null when both are absent', () => {
    expect(resolveValidityWording(null, null)).toBeNull();
  });

  it('returns null when both are undefined', () => {
    expect(resolveValidityWording(undefined, undefined)).toBeNull();
  });

  it('trims whitespace from gpMetaValidityPeriod', () => {
    expect(resolveValidityWording('  6 miesięcy  ', null)).toBe('6 miesięcy');
  });

  it('falls back to marketDefault when gpMeta is empty string', () => {
    expect(resolveValidityWording('', 'Ważny 6 miesięcy')).toBe('Ważny 6 miesięcy');
  });
});

describe('deriveVoucherClarityVariant', () => {
  it('returns default when product has price and no issues', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true })).toBe('default');
  });

  it('returns error when product has no price', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: false })).toBe('error');
  });

  it('returns error when voucher is expired in catalog', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true, isExpiredInCatalog: true })).toBe('error');
  });

  it('returns warning when vendor is unavailable (Story 5.6)', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true, isVendorUnavailable: true })).toBe('warning');
  });

  it('returns warning when region-restricted', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true, isRegionRestricted: true })).toBe('warning');
  });

  it('returns warning when out of stock', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true, isOutOfStock: true })).toBe('warning');
  });

  it('error takes priority over warning (expired before vendor unavailable)', () => {
    expect(
      deriveVoucherClarityVariant({
        hasPrice: true,
        isExpiredInCatalog: true,
        isVendorUnavailable: true,
      })
    ).toBe('error');
  });
});

describe('deriveSellerProofVariant', () => {
  it('returns unavailable when name is missing', () => {
    expect(
      deriveSellerProofVariant({
        hasName: false,
        hasVerificationStatus: false,
        hasRating: false,
        hasReviews: false,
        hasAddress: false,
      })
    ).toBe('unavailable');
  });

  it('returns complete when name + verification + reviews present', () => {
    expect(
      deriveSellerProofVariant({
        hasName: true,
        hasVerificationStatus: true,
        hasRating: true,
        hasReviews: true,
        hasAddress: true,
      })
    ).toBe('complete');
  });

  it('returns complete when name + verification + rating but no reviews', () => {
    expect(
      deriveSellerProofVariant({
        hasName: true,
        hasVerificationStatus: true,
        hasRating: true,
        hasReviews: false,
        hasAddress: true,
      })
    ).toBe('complete');
  });

  it('returns partial when name present but no verification or proof', () => {
    expect(
      deriveSellerProofVariant({
        hasName: true,
        hasVerificationStatus: false,
        hasRating: false,
        hasReviews: false,
        hasAddress: false,
      })
    ).toBe('partial');
  });

  it('returns partial when name + verification but no rating/reviews', () => {
    expect(
      deriveSellerProofVariant({
        hasName: true,
        hasVerificationStatus: true,
        hasRating: false,
        hasReviews: false,
        hasAddress: false,
      })
    ).toBe('partial');
  });
});
