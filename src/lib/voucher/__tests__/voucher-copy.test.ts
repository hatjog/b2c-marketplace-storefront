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
  derivePdpVoucherClarityVariant,
  deriveSellerProofVariant,
  voucherHelpHref,
  refundHelpAnchor,
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

describe('deriveVoucherClarityVariant (base — cart/checkout/recovery shared)', () => {
  it('returns default when product has price and is not expired', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true })).toBe('default');
  });

  it('returns error when product has no price', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: false })).toBe('error');
  });

  it('returns error when voucher is expired in catalog', () => {
    expect(deriveVoucherClarityVariant({ hasPrice: true, isExpiredInCatalog: true })).toBe('error');
  });

  it('does not accept PDP-only signals (no vendor_unavailable / region / stock)', () => {
    // F15 fix: base helper signature is intentionally minimal.
    expect(
      deriveVoucherClarityVariant({
        hasPrice: true,
        // @ts-expect-error PDP signals must not be on the base type
        isVendorUnavailable: true,
      }),
    ).toBe('default');
  });
});

describe('derivePdpVoucherClarityVariant (PDP wrapper — F15 fix)', () => {
  it('returns default when product has price and no PDP issues', () => {
    expect(derivePdpVoucherClarityVariant({ hasPrice: true })).toBe('default');
  });

  it('returns error when product has no price', () => {
    expect(derivePdpVoucherClarityVariant({ hasPrice: false })).toBe('error');
  });

  it('returns error when voucher is expired in catalog', () => {
    expect(derivePdpVoucherClarityVariant({ hasPrice: true, isExpiredInCatalog: true })).toBe('error');
  });

  it('returns warning when vendor is unavailable (Story 5.6)', () => {
    expect(derivePdpVoucherClarityVariant({ hasPrice: true, isVendorUnavailable: true })).toBe('warning');
  });

  it('returns warning when region-restricted', () => {
    expect(derivePdpVoucherClarityVariant({ hasPrice: true, isRegionRestricted: true })).toBe('warning');
  });

  it('returns warning when out of stock', () => {
    expect(derivePdpVoucherClarityVariant({ hasPrice: true, isOutOfStock: true })).toBe('warning');
  });

  it('error takes priority over warning (expired before vendor unavailable)', () => {
    expect(
      derivePdpVoucherClarityVariant({
        hasPrice: true,
        isExpiredInCatalog: true,
        isVendorUnavailable: true,
      })
    ).toBe('error');
  });
});

describe('voucherHelpHref / refundHelpAnchor (F26 fix — locale-aware helpers)', () => {
  it('voucherHelpHref prefixes with locale', () => {
    expect(voucherHelpHref('pl')).toBe('/pl/zasady');
    expect(voucherHelpHref('en')).toBe('/en/zasady');
  });

  it('refundHelpAnchor prefixes with locale and preserves anchor', () => {
    expect(refundHelpAnchor('pl')).toBe('/pl/zasady#zwroty');
    expect(refundHelpAnchor('de')).toBe('/de/zasady#zwroty');
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

  it('hasAddress is accepted but does NOT promote partial → complete (F10 fix)', () => {
    // Even with address present, missing rating + reviews keeps it partial
    expect(
      deriveSellerProofVariant({
        hasName: true,
        hasVerificationStatus: true,
        hasRating: false,
        hasReviews: false,
        hasAddress: true,
      })
    ).toBe('partial');
  });

  it('hasAddress is optional in signature (F10 fix)', () => {
    // Calling without hasAddress works
    expect(
      deriveSellerProofVariant({
        hasName: true,
        hasVerificationStatus: true,
        hasRating: true,
        hasReviews: true,
      })
    ).toBe('complete');
  });
});
