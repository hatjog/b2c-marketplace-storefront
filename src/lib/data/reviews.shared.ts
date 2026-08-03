import type { MercurOrderWithOrderGroup } from '@/types/medusa-extensions';
import type { SellerProps } from '@/types/seller';

export type OrderReview = {
  created_at?: string | Date | null;
  customer_note?: string | null;
  rating?: number | null;
};

export type Review = {
  id: string;
  seller: {
    id: string;
    name: string;
    photo: string;
  };
  reference: string;
  customer_note: string;
  rating: number;
  updated_at: string;
};

export type Order = MercurOrderWithOrderGroup & {
  seller: SellerProps;
  reviews: OrderReview[];
};

export function isReviewableOrder(
  order: MercurOrderWithOrderGroup | null | undefined
): order is Order {
  return Boolean(order?.seller?.id && order.seller?.name && Array.isArray(order.reviews));
}