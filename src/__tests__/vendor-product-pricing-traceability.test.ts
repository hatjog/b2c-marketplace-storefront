import { beforeEach, describe, expect, it, vi } from 'vitest';

import { groupLineItemsBySeller, readSelectedSeller } from '@/lib/helpers/cart-vendor-context';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import {
  buildSellerLineItemMetadata,
  isVendorOfferProjectionInactive,
  type VendorOfferProjectionMetadata,
} from '@/lib/helpers/vendor-product-traceability';
import type { MercurStoreVariant } from '@/types/medusa-extensions';

const fetchMock = vi.fn();

vi.mock('@/lib/config', () => ({
  sdk: {
    client: {
      fetch: fetchMock,
    },
  },
}));

const pricedVariant = {
  id: 'variant_bb_cut_90',
  title: '90 min',
  calculated_price: {
    calculated_amount: 12000,
    calculated_amount_with_tax: 14760,
    calculated_amount_without_tax: 12000,
    original_amount: 12000,
    original_amount_with_tax: 14760,
    currency_code: 'PLN',
    calculated_price: { price_list_type: 'override', id: 'plist_vendor_bb' },
  },
} as unknown as MercurStoreVariant;

describe('Story 2.7 vendor-product price-only traceability', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('keeps the product_id -> vendor_id -> seller_id -> price -> PDP chain on existing price-only data', () => {
    const product = {
      id: 'prod_bb_cut',
      title: 'Strzyzenie damskie',
      seller: {
        id: 'seller_bb',
        name: 'BonBeauty',
        handle: 'bonbeauty',
      },
      metadata: {
        gp: {
          vendor_id: 'vendor_bb',
          has_vendor_pricing: true,
        },
      },
      variants: [pricedVariant],
    };

    const { cheapestVariant, cheapestPrice } = getProductPrice({ product: product as any });

    expect(product.id).toBe('prod_bb_cut');
    expect((product.metadata.gp as Record<string, unknown>).vendor_id).toBe('vendor_bb');
    expect(product.seller.id).toBe('seller_bb');
    expect(cheapestVariant?.id).toBe('variant_bb_cut_90');
    expect(cheapestPrice?.price_type).toBe('override');
    expect(cheapestPrice?.calculated_price_number).toBe(14760);
    expect(cheapestPrice?.currency_code).toBe('PLN');
    expect(cheapestPrice?.calculated_price).toContain('147');
  });

  it('propagates selected_seller_id from PDP selection into cart metadata and seller grouping', () => {
    const metadata = buildSellerLineItemMetadata({
      selectedSellerId: 'seller_bb',
      selectedSellerName: 'BonBeauty',
      selectedSellerHandle: 'bonbeauty',
    });

    expect(metadata).toEqual({
      selected_seller_id: 'seller_bb',
      selected_seller_name: 'BonBeauty',
      selected_seller_handle: 'bonbeauty',
    });

    const item = {
      id: 'line_1',
      variant_id: 'variant_bb_cut_90',
      quantity: 1,
      subtotal: 12000,
      total: 14760,
      metadata,
    } as any;

    expect(readSelectedSeller(item)).toEqual({
      id: 'seller_bb',
      name: 'BonBeauty',
      handle: 'bonbeauty',
    });

    const [group] = groupLineItemsBySeller([item]);
    expect(group.seller_id).toBe('seller_bb');
    expect(group.subtotal).toBe(12000);
    expect(group.items).toHaveLength(1);
  });

  it('reads checkout order-set splits by cart id without recomputing pricing or seller choice', async () => {
    fetchMock.mockResolvedValueOnce({
      order_set_splits: [
        {
          seller_id: 'seller_bb',
          seller_name: 'BonBeauty',
          seller_handle: 'bonbeauty',
          subtotal: 12000,
          item_count: 1,
        },
      ],
    });

    const { listOrderSetSplits } = await import('@/lib/data/order-sets');
    const splits = await listOrderSetSplits('cart_bb');

    expect(fetchMock).toHaveBeenCalledWith('/store/carts/cart_bb/order-sets', {
      method: 'GET',
      cache: 'no-store',
    });
    expect(splits).toEqual([
      {
        seller_id: 'seller_bb',
        seller_name: 'BonBeauty',
        seller_handle: 'bonbeauty',
        subtotal: 12000,
        item_count: 1,
      },
    ]);
  });

  it('treats metadata.gp vendor-offer projection as optional over the price-only baseline', () => {
    expect(isVendorOfferProjectionInactive(undefined)).toBe(true);
    expect(isVendorOfferProjectionInactive({})).toBe(true);

    const projection: VendorOfferProjectionMetadata = {
      desc: 'Opis wariantu oferty dla vendora',
      media: [{ type: 'image', ref: 'asset_bb_cut' }],
      custom_duration: 90,
      notes: null,
    };

    expect(isVendorOfferProjectionInactive(projection)).toBe(false);
  });
});
