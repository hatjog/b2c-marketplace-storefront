import { describe, expect, it } from 'vitest';

import { getPricesForVariant, getProductPrice } from '../get-product-price';

const makeVariant = (calculatedAmount: number | null, calculatedAmountWithTax?: number | null) => ({
  id: 'var_1',
  calculated_price: calculatedAmount !== null
    ? {
        calculated_amount: calculatedAmount,
        calculated_amount_with_tax: calculatedAmountWithTax ?? calculatedAmount,
        calculated_amount_without_tax: calculatedAmount,
        original_amount: calculatedAmount,
        original_amount_with_tax: calculatedAmountWithTax ?? calculatedAmount,
        currency_code: 'pln',
        calculated_price: { price_list_type: null }
      }
    : null
});

describe('getPricesForVariant', () => {
  it('returns null when calculated_price is null (no vendor)', () => {
    const variant = makeVariant(null);
    expect(getPricesForVariant(variant)).toBeNull();
  });

  it('returns price object when calculated_amount is 0 (free product)', () => {
    const variant = makeVariant(0);
    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result?.calculated_price_number).toBe(0);
  });

  it('returns price object for normal positive price', () => {
    const variant = makeVariant(10000);
    const result = getPricesForVariant(variant);
    expect(result).not.toBeNull();
    expect(result?.calculated_price_number).toBe(10000);
  });

  it('returns null when variant is undefined', () => {
    expect(getPricesForVariant(undefined)).toBeNull();
  });
});

describe('getProductPrice - free product (calculated_price = 0)', () => {
  const freeProduct = {
    id: 'prod_1',
    variants: [makeVariant(0)]
  } as any;

  it('cheapestPrice is not null for free product', () => {
    const { cheapestPrice } = getProductPrice({ product: freeProduct });
    expect(cheapestPrice).not.toBeNull();
    expect(cheapestPrice?.calculated_price_number).toBe(0);
  });

  it('cheapestVariant is not null for free product', () => {
    const { cheapestVariant } = getProductPrice({ product: freeProduct });
    expect(cheapestVariant).not.toBeNull();
  });
});

describe('getProductPrice - no vendor (all calculated_price null)', () => {
  const noVendorProduct = {
    id: 'prod_2',
    variants: [makeVariant(null), makeVariant(null)]
  } as any;

  it('cheapestPrice is null when all variants have no price', () => {
    const { cheapestPrice } = getProductPrice({ product: noVendorProduct });
    expect(cheapestPrice).toBeNull();
  });

  it('cheapestVariant is null when all variants have no price', () => {
    const { cheapestVariant } = getProductPrice({ product: noVendorProduct });
    expect(cheapestVariant).toBeNull();
  });
});

describe('getProductPrice - auto-select cheapest available variant', () => {
  const product = {
    id: 'prod_3',
    variants: [
      { ...makeVariant(20000), id: 'var_expensive' },
      { ...makeVariant(5000), id: 'var_cheap' },
      { ...makeVariant(null), id: 'var_no_price' }
    ]
  } as any;

  it('selects cheapest variant by calculated_price', () => {
    const { cheapestVariant } = getProductPrice({ product });
    expect(cheapestVariant?.id).toBe('var_cheap');
  });

  it('skips variants with null calculated_price', () => {
    const { cheapestVariant } = getProductPrice({ product });
    expect(cheapestVariant?.id).not.toBe('var_no_price');
  });
});
