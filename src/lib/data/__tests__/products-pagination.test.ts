import { describe, expect, it } from 'vitest';

import { paginateSortedProducts } from '../products-pagination';

describe('paginateSortedProducts', () => {
  const products = Array.from({ length: 7 }, (_, index) => ({ id: `prod-${index + 1}` }));

  it('returns the first page when limit is provided', () => {
    const result = paginateSortedProducts(products, 1, 3);

    expect(result.products.map(product => product.id)).toEqual(['prod-1', 'prod-2', 'prod-3']);
    expect(result.nextPage).toBe(2);
  });

  it('returns the requested middle page', () => {
    const result = paginateSortedProducts(products, 2, 3);

    expect(result.products.map(product => product.id)).toEqual(['prod-4', 'prod-5', 'prod-6']);
    expect(result.nextPage).toBe(3);
  });

  it('returns the last page without a next page', () => {
    const result = paginateSortedProducts(products, 3, 3);

    expect(result.products.map(product => product.id)).toEqual(['prod-7']);
    expect(result.nextPage).toBeNull();
  });

  it('returns an empty page when the page number is beyond the result set', () => {
    const result = paginateSortedProducts(products, 4, 3);

    expect(result.products).toEqual([]);
    expect(result.nextPage).toBeNull();
  });

  it('returns all products unchanged when limit is omitted', () => {
    const result = paginateSortedProducts(products, 2);

    expect(result.products).toEqual(products);
    expect(result.nextPage).toBeNull();
  });
});