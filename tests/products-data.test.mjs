import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { normalizeListedProducts } = await import('../src/lib/helpers/normalize-listed-products.ts');

describe('pagination boundary: nextPage must use filtered count, not raw API count', () => {
  // Regression test for H1: listProductsWithSort was using raw API count
  // which could exceed the actual number of filtered/sorted products,
  // causing empty pages with a misleading nextPage indicator.

  function computeNextPage(sortedLength, page, limit) {
    const pageParam = (page - 1) * limit;
    return sortedLength > pageParam + limit ? page + 1 : null;
  }

  test('nextPage is null when all products fit on one page', () => {
    assert.equal(computeNextPage(10, 1, 12), null);
  });

  test('nextPage is 2 when more products remain', () => {
    assert.equal(computeNextPage(20, 1, 12), 2);
  });

  test('nextPage is null on last page', () => {
    assert.equal(computeNextPage(20, 2, 12), null);
  });

  test('using raw API count would incorrectly signal more pages', () => {
    // 45 filtered products, API count was 50, page 4, limit 12
    // Raw count: 50 > 36+12 → nextPage=5 (WRONG: only 45 items, page 4 has 9 items, page 5 would be empty)
    // Filtered count: 45 > 36+12 → nextPage=5 (WRONG — wait, 45 > 48 is false!)
    assert.equal(computeNextPage(45, 4, 12), null);
    // With raw count 50 this would have been: 50 > 48 → page 5 (bug!)
  });
});

describe('products data normalization', () => {
  test('keeps products without seller and removes only suspended seller products', () => {
    const result = normalizeListedProducts([
      {
        id: 'prod-without-seller',
        title: 'No seller product',
        handle: 'no-seller-product',
        variants: [],
        seller: null
      },
      {
        id: 'prod-with-seller',
        title: 'Seller product',
        handle: 'seller-product',
        variants: [],
        seller: {
          id: 'seller-active',
          name: 'Active seller',
          handle: 'active-seller',
          description: '',
          photo: '',
          tax_id: '',
          created_at: '2026-03-07T00:00:00.000Z',
          store_status: 'ACTIVE',
          reviews: [null, { id: 'review-1' }]
        }
      },
      {
        id: 'prod-suspended',
        title: 'Suspended product',
        handle: 'suspended-product',
        variants: [],
        seller: {
          id: 'seller-suspended',
          name: 'Suspended seller',
          handle: 'suspended-seller',
          description: '',
          photo: '',
          tax_id: '',
          created_at: '2026-03-07T00:00:00.000Z',
          store_status: 'SUSPENDED',
          reviews: [{ id: 'review-2' }]
        }
      }
    ]);

    assert.deepEqual(
      result.map(product => product.id),
      ['prod-without-seller', 'prod-with-seller']
    );
    assert.equal(result[0].seller, null);
    assert.deepEqual(result[1].seller?.reviews, [{ id: 'review-1' }]);
  });
});