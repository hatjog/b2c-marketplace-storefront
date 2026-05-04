import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isMultiVendorEnabled, hasMultiVendorFields, getCurrentFlagValue } from './multiVendorPricing';

/**
 * Story v160-cleanup-12b AC2 — unit coverage for isMultiVendorEnabled and type guards.
 *
 * Tests:
 *  1. isMultiVendorEnabled returns false when env unset
 *  2. isMultiVendorEnabled returns true when env === 'true'
 *  3. isMultiVendorEnabled returns false for '1', 'on', 'false', 'TRUE'
 *  4. hasMultiVendorFields returns true for complete fields
 *  5. hasMultiVendorFields returns false when fields missing
 *  6. getCurrentFlagValue re-export works
 */

describe('multiVendorPricing flags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isMultiVendorEnabled', () => {
    it('returns false when env unset', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', '');
      expect(isMultiVendorEnabled()).toBe(false);
    });

    it('returns true when env === "true"', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'true');
      expect(isMultiVendorEnabled()).toBe(true);
    });

    it('returns false for "1" (non-strict)', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', '1');
      expect(isMultiVendorEnabled()).toBe(false);
    });

    it('returns false for "on"', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'on');
      expect(isMultiVendorEnabled()).toBe(false);
    });

    it('returns false for "TRUE" (case-sensitive)', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'TRUE');
      expect(isMultiVendorEnabled()).toBe(false);
    });

    it('returns false for "false"', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'false');
      expect(isMultiVendorEnabled()).toBe(false);
    });
  });

  describe('hasMultiVendorFields', () => {
    it('returns true when vendor_count and lowest_price_pln are numbers', () => {
      expect(hasMultiVendorFields({ vendor_count: 3, lowest_price_pln: 4999 })).toBe(true);
    });

    it('returns true when vendor_count is 0 (still a number)', () => {
      expect(hasMultiVendorFields({ vendor_count: 0, lowest_price_pln: 0 })).toBe(true);
    });

    it('returns false when vendor_count is missing', () => {
      expect(hasMultiVendorFields({ lowest_price_pln: 4999 })).toBe(false);
    });

    it('returns false when lowest_price_pln is missing', () => {
      expect(hasMultiVendorFields({ vendor_count: 3 })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(hasMultiVendorFields({})).toBe(false);
    });

    it('returns false when vendor_count is string', () => {
      expect(hasMultiVendorFields({ vendor_count: '3', lowest_price_pln: 4999 })).toBe(false);
    });
  });

  describe('getCurrentFlagValue re-export', () => {
    it('is the same function as underlying flagAtomicCheck.getCurrentFlagValue', () => {
      vi.stubEnv('NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED', 'true');
      expect(getCurrentFlagValue()).toBe(true);
    });
  });
});
