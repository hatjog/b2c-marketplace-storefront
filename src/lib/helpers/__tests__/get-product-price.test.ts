import { describe, expect, it } from 'vitest';

import { getPricesForVariant } from '../get-product-price';

const BASE_CALCULATED_PRICE = {
  calculated_amount: 1000,
  calculated_amount_with_tax: 1230,
  calculated_amount_without_tax: 1000,
  original_amount: 1500,
  original_amount_with_tax: 1845,
  currency_code: 'PLN',
  calculated_price: null
};

describe('getPricesForVariant', () => {
  it('returns null when variant is null', () => {
    expect(getPricesForVariant(null)).toBeNull();
  });

  it('returns null when variant has no calculated_price', () => {
    expect(getPricesForVariant({})).toBeNull();
    expect(getPricesForVariant({ calculated_price: null })).toBeNull();
    expect(getPricesForVariant({ calculated_price: undefined })).toBeNull();
  });

  it('returns null when both calculated_amount_with_tax and calculated_amount are null', () => {
    const variant = {
      calculated_price: {
        ...BASE_CALCULATED_PRICE,
        calculated_amount: null,
        calculated_amount_with_tax: null
      }
    };
    expect(getPricesForVariant(variant)).toBeNull();
  });

  it('does NOT crash and returns price_type: null when inner calculated_price is null (AC1)', () => {
    const variant = {
      calculated_price: {
        ...BASE_CALCULATED_PRICE,
        calculated_price: null // inner sub-object is null → was crashing
      }
    };
    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result!.price_type).toBeNull();
  });

  it('returns price_type from inner calculated_price when present (AC2)', () => {
    const variant = {
      calculated_price: {
        ...BASE_CALCULATED_PRICE,
        calculated_price: { price_list_type: 'sale' }
      }
    };
    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result!.price_type).toBe('sale');
  });

  it('uses calculated_amount_with_tax branch when available', () => {
    const variant = {
      calculated_price: {
        ...BASE_CALCULATED_PRICE,
        calculated_price: { price_list_type: 'override' }
      }
    };
    const result = getPricesForVariant(variant);
    expect(result!.calculated_price_number).toBe(1230);
    expect(result!.original_price_number).toBe(1845);
    expect(result!.currency_code).toBe('PLN');
  });

  it('uses calculated_amount branch when calculated_amount_with_tax is null', () => {
    const variant = {
      calculated_price: {
        ...BASE_CALCULATED_PRICE,
        calculated_amount_with_tax: null,
        calculated_price: null
      }
    };
    const result = getPricesForVariant(variant);
    expect(result!.calculated_price_number).toBe(1000);
    expect(result!.price_type).toBeNull();
  });
});
