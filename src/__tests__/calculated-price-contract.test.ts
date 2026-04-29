import { describe, expect, it } from 'vitest';

import { getPricesForVariant } from '@/lib/helpers/get-product-price';
import type {
  MercurCalculatedPrice,
  MercurStoreVariant,
} from '@/types/medusa-extensions';

/**
 * D-01 calculated_price contract test (v1.4.0 carry-over closure).
 *
 * Asserts that the storefront expectation of the `calculated_price` payload
 * matches the documented backend response shape (Mercur Store API). The
 * OUTER `calculated_price` carries amounts; the INNER `calculated_price` (a
 * sub-object on the outer) carries price-list metadata. Both shapes — inner
 * = null, inner = { price_list_type: 'sale' | 'override' } — must be tolerated
 * by `getPricesForVariant` without crashing or losing data.
 *
 * If this test starts failing, the runtime contract has drifted; coordinate
 * with backend team to re-align before adjusting the type or the helper.
 */

describe('D-01 calculated_price contract — storefront ↔ Mercur Store API', () => {
  it('accepts inner calculated_price = null (most common shape)', () => {
    const calculated_price: MercurCalculatedPrice = {
      calculated_amount: 12000,
      calculated_amount_with_tax: 14760,
      calculated_amount_without_tax: 12000,
      original_amount: 15000,
      original_amount_with_tax: 18450,
      currency_code: 'PLN',
      calculated_price: null,
    };
    const variant: MercurStoreVariant = {
      // Cast: vitest fixtures only need the price-related keys for this contract test
      id: 'var_01',
      title: 'Default',
      calculated_price,
    } as unknown as MercurStoreVariant;

    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result!.price_type).toBeNull();
    expect(result!.calculated_price_number).toBe(14760);
    expect(result!.currency_code).toBe('PLN');
  });

  it('accepts inner calculated_price = { price_list_type: "sale" } (price list applies)', () => {
    const calculated_price: MercurCalculatedPrice = {
      calculated_amount: 9000,
      calculated_amount_with_tax: 11070,
      calculated_amount_without_tax: 9000,
      original_amount: 12000,
      original_amount_with_tax: 14760,
      currency_code: 'PLN',
      calculated_price: { price_list_type: 'sale', id: 'plist_01' },
    };
    const variant: MercurStoreVariant = {
      id: 'var_02',
      title: 'Sale',
      calculated_price,
    } as unknown as MercurStoreVariant;

    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result!.price_type).toBe('sale');
  });

  it('accepts inner calculated_price = { price_list_type: "override" }', () => {
    const calculated_price: MercurCalculatedPrice = {
      calculated_amount: 8000,
      calculated_amount_with_tax: 9840,
      calculated_amount_without_tax: 8000,
      original_amount: 10000,
      original_amount_with_tax: 12300,
      currency_code: 'PLN',
      calculated_price: { price_list_type: 'override', id: 'plist_02' },
    };
    const variant: MercurStoreVariant = {
      id: 'var_03',
      title: 'Override',
      calculated_price,
    } as unknown as MercurStoreVariant;

    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result!.price_type).toBe('override');
  });

  it('returns null when outer calculated_price is null', () => {
    const variant: MercurStoreVariant = {
      id: 'var_04',
      title: 'No price',
      calculated_price: null,
    } as unknown as MercurStoreVariant;

    expect(getPricesForVariant(variant)).toBeNull();
  });

  it('handles partial-tax-data branch (calculated_amount_with_tax = null)', () => {
    const calculated_price: MercurCalculatedPrice = {
      calculated_amount: 5000,
      calculated_amount_with_tax: null,
      calculated_amount_without_tax: 5000,
      original_amount: 6000,
      original_amount_with_tax: null,
      currency_code: 'PLN',
      calculated_price: null,
    };
    const variant: MercurStoreVariant = {
      id: 'var_05',
      title: 'Tax-exempt',
      calculated_price,
    } as unknown as MercurStoreVariant;

    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result!.calculated_price_number).toBe(5000);
    expect(result!.price_type).toBeNull();
  });
});
