import { sdk } from '../config';

export type OrderSetSplit = {
  seller_id: string;
  seller_name: string | null;
  seller_handle: string | null;
  subtotal: number;
  item_count: number;
};

/**
 * Story v160-cleanup-15e — AC2/AC4 fix.
 *
 * Fetches per-vendor order_set splits from backend (single computation
 * path). Replaces the prior client-side `groupLineItemsBySeller` call
 * inside `MultiVendorOrderSummary` to eliminate drift between backend
 * and storefront.
 *
 * Backend returns `{ order_set_splits: [] }` when:
 *   - flag !== "on"
 *   - cart has no line items
 *   - no items have `metadata.selected_seller_id`
 *
 * Returns [] on any fetch error so the component can render-null gracefully.
 */
export const listOrderSetSplits = async (cartId: string): Promise<OrderSetSplit[]> => {
  return sdk.client
    .fetch<{ order_set_splits: OrderSetSplit[] }>(`/store/carts/${cartId}/order-sets`, {
      method: 'GET',
      cache: 'no-store'
    })
    .then(({ order_set_splits }) => order_set_splits ?? [])
    .catch(() => []);
};
