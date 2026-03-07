import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { normalizeListedProducts } = await import('../src/lib/helpers/normalize-listed-products.ts');

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