import type { HttpTypes } from '@medusajs/types';
import { describe, expect, it } from 'vitest';

import { filterCrossSellProducts, filterCrossSellSellerProducts } from '../filters';

function makeProduct(
  id: string,
  calculatedPrice: number | null = 10000,
): HttpTypes.StoreProduct {
  return {
    id,
    title: `Product ${id}`,
    handle: `product-${id}`,
    status: 'published',
    variants: calculatedPrice !== null
      ? [{ id: `v-${id}`, calculated_price: calculatedPrice } as any]
      : [{ id: `v-${id}`, calculated_price: null } as any],
  } as HttpTypes.StoreProduct;
}

describe('filterCrossSellProducts', () => {
  const CURRENT_ID = 'current-product';

  // AC 3: current product excluded
  it('excludes the current product from results', () => {
    const products = [makeProduct(CURRENT_ID), makeProduct('other-1'), makeProduct('other-2')];
    const result = filterCrossSellProducts(products, CURRENT_ID);
    expect(result.map(p => p.id)).not.toContain(CURRENT_ID);
  });

  // AC 4: calculated_price null → excluded
  it('excludes products where calculated_price is null', () => {
    const products = [
      makeProduct('p1', 10000),
      makeProduct('p2', null),
      makeProduct('p3', 20000),
    ];
    const result = filterCrossSellProducts(products, CURRENT_ID);
    expect(result.map(p => p.id)).toEqual(['p1', 'p3']);
  });

  // AC 1/2: max 4 products per group
  it('returns at most 4 products', () => {
    const products = Array.from({ length: 8 }, (_, i) => makeProduct(`p${i}`));
    const result = filterCrossSellProducts(products, CURRENT_ID);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  // AC 3 + AC 1/2: current excluded before taking max 4
  it('applies current product exclusion before slicing to max 4', () => {
    // 6 products including current; after exclusion → 5 remain, only 4 returned
    const products = [
      makeProduct(CURRENT_ID),
      ...Array.from({ length: 5 }, (_, i) => makeProduct(`p${i}`)),
    ];
    const result = filterCrossSellProducts(products, CURRENT_ID);
    expect(result.length).toBe(4);
    expect(result.map(p => p.id)).not.toContain(CURRENT_ID);
  });

  // AC 4: no variants → excluded
  it('excludes products with no variants', () => {
    const noVariantProduct = {
      id: 'no-variant',
      title: 'No variant',
      status: 'published',
      variants: [],
    } as unknown as HttpTypes.StoreProduct;
    const result = filterCrossSellProducts([noVariantProduct, makeProduct('ok')], CURRENT_ID);
    expect(result.map(p => p.id)).not.toContain('no-variant');
    expect(result.map(p => p.id)).toContain('ok');
  });

  it('returns empty array when all products have null calculated_price', () => {
    const products = [makeProduct('p1', null), makeProduct('p2', null)];
    const result = filterCrossSellProducts(products, CURRENT_ID);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no products provided', () => {
    expect(filterCrossSellProducts([], CURRENT_ID)).toHaveLength(0);
  });

  it('includes products where only a non-first variant has calculated_price', () => {
    const product = {
      id: 'multi-variant',
      title: 'Multi variant',
      status: 'published',
      variants: [
        { id: 'v1', calculated_price: null } as any,
        { id: 'v2', calculated_price: 5000 } as any,
      ],
    } as unknown as HttpTypes.StoreProduct;
    const result = filterCrossSellProducts([product], CURRENT_ID);
    expect(result.map(p => p.id)).toContain('multi-variant');
  });
});

describe('filterCrossSellSellerProducts', () => {
  const CURRENT_ID = 'current-product';

  // AC 1: priceless seller products are excluded (same rule as filterCrossSellProducts)
  it('excludes seller products where all variants have null calculated_price', () => {
    const product = {
      id: 'seller-prod',
      title: 'Seller product',
      status: 'published',
      variants: [{ id: 'v1', calculated_price: null } as any],
    } as unknown as HttpTypes.StoreProduct;
    const result = filterCrossSellSellerProducts([product], CURRENT_ID);
    expect(result.map(p => p.id)).not.toContain('seller-prod');
  });

  // AC 2: seller products with a price are included
  it('includes seller products when at least one variant has calculated_price', () => {
    const product = makeProduct('seller-priced', 5000);
    const result = filterCrossSellSellerProducts([product], CURRENT_ID);
    expect(result.map(p => p.id)).toContain('seller-priced');
  });

  it('excludes the current product', () => {
    const products = [makeProduct(CURRENT_ID), makeProduct('other')];
    const result = filterCrossSellSellerProducts(products, CURRENT_ID);
    expect(result.map(p => p.id)).not.toContain(CURRENT_ID);
  });

  it('returns at most 4 products', () => {
    const products = Array.from({ length: 8 }, (_, i) => makeProduct(`p${i}`));
    const result = filterCrossSellSellerProducts(products, CURRENT_ID);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('returns empty array when all seller products are priceless', () => {
    const products = [makeProduct('p1', null), makeProduct('p2', null)];
    const result = filterCrossSellSellerProducts(products, CURRENT_ID);
    expect(result).toHaveLength(0);
  });
});
