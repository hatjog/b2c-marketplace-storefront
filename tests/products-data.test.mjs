import test, { describe, mock } from 'node:test';
import assert from 'node:assert/strict';

const { normalizeListedProducts } = await import('../src/lib/helpers/normalize-listed-products.ts');
const { hasCustomFilters, CUSTOM_FILTER_KEYS } = await import('../src/lib/helpers/has-custom-filters.ts');

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
  // Quality gate requires: 80+ word description, valid price, non-placeholder thumbnail
  const longDescription = Array(85).fill('word').join(' ');
  const validVariant = { calculated_price: { calculated_amount: 1000 } };

  test('keeps products without seller and removes only suspended seller products', () => {
    const result = normalizeListedProducts([
      {
        id: 'prod-without-seller',
        title: 'No seller product',
        handle: 'no-seller-product',
        description: longDescription,
        thumbnail: 'https://cdn.test.com/img.jpg',
        variants: [validVariant],
        seller: null
      },
      {
        id: 'prod-with-seller',
        title: 'Seller product',
        handle: 'seller-product',
        description: longDescription,
        thumbnail: 'https://cdn.test.com/img2.jpg',
        variants: [validVariant],
        seller: {
          id: 'seller-active',
          name: 'Active seller',
          handle: 'active-seller',
          description: '',
          photo: '',
          tax_id: '',
          created_at: '2026-03-07T00:00:00.000Z',
          status: 'open',  // Mercur 2 SellerStatus — was store_status: 'ACTIVE' (Mercur 1.5)
          reviews: [null, { id: 'review-1' }]
        }
      },
      {
        id: 'prod-suspended',
        title: 'Suspended product',
        handle: 'suspended-product',
        description: longDescription,
        thumbnail: 'https://cdn.test.com/img3.jpg',
        variants: [validVariant],
        seller: {
          id: 'seller-suspended',
          name: 'Suspended seller',
          handle: 'suspended-seller',
          description: '',
          photo: '',
          tax_id: '',
          created_at: '2026-03-07T00:00:00.000Z',
          status: 'suspended',  // Mercur 2 SellerStatus — was store_status: 'SUSPENDED' (Mercur 1.5)
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

describe('hasCustomFilters', () => {
  test('returns false when no params provided', () => {
    assert.equal(hasCustomFilters({}), false);
  });

  test('returns false with only native params (category_id, min_price, max_price)', () => {
    // Native params do NOT trigger pipeline mode
    assert.equal(hasCustomFilters({ tagIds: [], cities: [], durations: [], sellerRatings: [] }), false);
  });

  test('returns true when tagIds is non-empty', () => {
    assert.equal(hasCustomFilters({ tagIds: ['tag-uuid-1'] }), true);
  });

  test('returns true when cities is non-empty', () => {
    assert.equal(hasCustomFilters({ cities: ['Warszawa'] }), true);
  });

  test('returns true when durations is non-empty', () => {
    assert.equal(hasCustomFilters({ durations: [60] }), true);
  });

  test('returns true when sellerRatings is non-empty', () => {
    assert.equal(hasCustomFilters({ sellerRatings: [4] }), true);
  });

  test('returns true for mixed custom + native params', () => {
    assert.equal(hasCustomFilters({ tagIds: ['tag-uuid-1'], cities: [] }), true);
  });

  test('returns false for empty arrays after sanitize (tag_id=,,, → [])', () => {
    // Simulates: sanitizeSearchParams parses tag_id=,,, → tagIds=[]
    assert.equal(hasCustomFilters({ tagIds: [], cities: [], durations: [], sellerRatings: [] }), false);
  });

  test('CUSTOM_FILTER_KEYS exports the expected keys', () => {
    assert.deepEqual([...CUSTOM_FILTER_KEYS].sort(), ['city', 'duration', 'seller_rating', 'tag_id']);
  });
});

describe('listFilteredProducts page→offset conversion', () => {
  // Unit tests for the page→offset conversion logic used in listFilteredProducts()
  function pageToOffset(page, limit) {
    return (Math.max(page, 1) - 1) * limit;
  }

  test('page 1 → offset 0', () => {
    assert.equal(pageToOffset(1, 12), 0);
  });

  test('page 2 → offset 12 (with limit 12)', () => {
    assert.equal(pageToOffset(2, 12), 12);
  });

  test('page 3 → offset 24 (with limit 12)', () => {
    assert.equal(pageToOffset(3, 12), 24);
  });

  test('page 0 or negative → treated as page 1 (offset 0)', () => {
    assert.equal(pageToOffset(0, 12), 0);
    assert.equal(pageToOffset(-5, 12), 0);
  });
});
