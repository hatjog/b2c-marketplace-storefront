import type { HttpTypes } from '@medusajs/types';

import type { SellerProps } from './seller';

/**
 * Type contract for the Mercur Store API `calculated_price` payload as
 * delivered to the storefront PDP / listing fetchers. Mirrors the runtime
 * shape verified by `getPricesForVariant` and the integration test
 * `__tests__/calculated-price-contract.test.ts` (D-01 carry-over).
 *
 * The OUTER `calculated_price` (on the variant) carries the calculated/original
 * amounts plus an INNER `calculated_price` sub-object that surfaces price-list
 * metadata (price_list_type: 'sale' | 'override' | …). The double-nest is
 * intentional and matches Medusa's PricingService response shape — see
 * `_bmad-output/implementation-artifacts/archive-v1.4.0/v140-deferred-from-v130.md`
 * D-01 reconciliation.
 */
export type MercurCalculatedPriceInner = {
  /** Price list classification, null when no price list applies. */
  price_list_type?: 'sale' | 'override' | string | null;
  /** Mercur price list ID (opaque). */
  id?: string | null;
} | null;

export type MercurCalculatedPrice = {
  calculated_amount: number | null;
  calculated_amount_with_tax: number | null;
  calculated_amount_without_tax: number | null;
  original_amount: number | null;
  original_amount_with_tax: number | null;
  currency_code: string;
  /**
   * Inner price-list metadata. May be null for products without a price list
   * binding. `getPricesForVariant` reads `inner?.price_list_type` defensively.
   */
  calculated_price: MercurCalculatedPriceInner;
} | null;

export type MercurStoreVariant = HttpTypes.StoreProductVariant & {
  calculated_price?: MercurCalculatedPrice;
};

export type OrderSet = {
  id: string;
  created_at?: string | null;
  display_id?: number | string | null;
  orders?: MercurOrder[];
  payment_collection?: {
    currency_code?: string | null;
  } | null;
  shipping_total?: number | null;
  total?: number | null;
};

export type MercurOrderShippingMethod = NonNullable<HttpTypes.StoreOrder['shipping_methods']>[number] & {
  name?: string | null;
};

export type MercurOrder = HttpTypes.StoreOrder & {
  seller?: SellerProps | null;
  reviews?: unknown[];
  order_set?: OrderSet | null;
  shipping_methods?: MercurOrderShippingMethod[] | null;
};

export type MercurOrderWithOrderSet = MercurOrder & {
  order_set: OrderSet;
};

export type MercurCollection = HttpTypes.StoreCollection & {
  description?: string | null;
};

export type MercurProduct = HttpTypes.StoreProduct & {
  seller?: SellerProps | null;
};