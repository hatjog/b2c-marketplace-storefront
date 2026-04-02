import type { HttpTypes } from '@medusajs/types';

import type { SellerProps } from './seller';

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