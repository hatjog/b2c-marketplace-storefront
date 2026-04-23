import type { MercurOrderWithOrderSet } from '@/types/medusa-extensions';
import type { SellerProps } from '@/types/seller';

export type OrderReview = {
  created_at?: string | Date | null;
  customer_note?: string | null;
  rating?: number | null;
};

export type Order = MercurOrderWithOrderSet & {
  seller: SellerProps;
  reviews: OrderReview[];
};

export function isReviewableOrder(
  order: MercurOrderWithOrderSet | null | undefined
): order is Order {
  return Boolean(order?.seller?.id && order.seller?.name && Array.isArray(order.reviews));
}