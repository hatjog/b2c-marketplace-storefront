import { describe, expect, it } from 'vitest';
import type { HttpTypes } from '@medusajs/types';

import { applyCategoryPlpSemanticFilters } from '../category-plp-semantic-filters';

function makeProduct(
  id: string,
  params?: {
    sellerHandle?: string;
    purchaseMode?: unknown;
    inStock?: unknown;
    variants?: Array<{
      manage_inventory?: boolean | null;
      allow_backorder?: boolean | null;
      inventory_quantity?: number | null;
    }>;
  }
): HttpTypes.StoreProduct {
  return {
    id,
    seller: params?.sellerHandle ? { handle: params.sellerHandle } : undefined,
    metadata: params?.purchaseMode || params?.inStock != null
      ? {
          gp: {
            purchase_mode: params?.purchaseMode,
            in_stock: params?.inStock,
          },
        }
      : undefined,
    variants: params?.variants as HttpTypes.StoreProductVariant[] | undefined,
  } as unknown as HttpTypes.StoreProduct;
}

describe('applyCategoryPlpSemanticFilters', () => {
  it('filtruje po salonie przed paginacją', () => {
    const products = [
      makeProduct('a', { sellerHandle: 'alpha' }),
      makeProduct('b', { sellerHandle: 'beta' }),
    ];

    const filtered = applyCategoryPlpSemanticFilters(products, { salonHandle: 'alpha' });
    expect(filtered.map((p) => p.id)).toEqual(['a']);
  });

  it('mode=self nie jest no-op: wyklucza gift-only', () => {
    const products = [
      makeProduct('self', { purchaseMode: 'self' }),
      makeProduct('gift', { purchaseMode: 'gift' }),
      makeProduct('both-missing'),
    ];

    const filtered = applyCategoryPlpSemanticFilters(products, { purchaseMode: 'self' });
    expect(filtered.map((p) => p.id)).toEqual(['self', 'both-missing']);
  });

  it('mode=gift przepuszcza gift i both, odrzuca self-only', () => {
    const products = [
      makeProduct('self', { purchaseMode: 'self' }),
      makeProduct('gift', { purchaseMode: 'gift' }),
      makeProduct('both-explicit', { purchaseMode: 'both' }),
      makeProduct('both-missing'),
    ];

    const filtered = applyCategoryPlpSemanticFilters(products, { purchaseMode: 'gift' });
    expect(filtered.map((p) => p.id)).toEqual(['gift', 'both-explicit', 'both-missing']);
  });

  it('availability=in_stock nie ukrywa produktu przy brakującym inventory_quantity', () => {
    const products = [
      makeProduct('unknown-inventory', {
        variants: [{ manage_inventory: true, allow_backorder: false, inventory_quantity: null }],
      }),
      makeProduct('out', {
        variants: [{ manage_inventory: true, allow_backorder: false, inventory_quantity: 0 }],
      }),
      makeProduct('in', {
        variants: [{ manage_inventory: true, allow_backorder: false, inventory_quantity: 3 }],
      }),
    ];

    const filtered = applyCategoryPlpSemanticFilters(products, { availability: 'in_stock' });
    expect(filtered.map((p) => p.id)).toEqual(['unknown-inventory', 'in']);
  });

  it('kontraktowe metadata.in_stock ma priorytet nad inferencją wariantów', () => {
    const products = [
      makeProduct('explicit-false', {
        inStock: false,
        variants: [{ manage_inventory: false }],
      }),
      makeProduct('explicit-true', {
        inStock: true,
        variants: [{ manage_inventory: true, inventory_quantity: 0 }],
      }),
    ];

    const filtered = applyCategoryPlpSemanticFilters(products, { availability: 'in_stock' });
    expect(filtered.map((p) => p.id)).toEqual(['explicit-true']);
  });
});
