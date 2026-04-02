import type { SellerProps } from '@/types/seller';

import { sdk } from '../config';

export interface SellerListItem {
  handle: string;
  name: string;
  photo_url: string | null;
  city: string | null;
  product_count: number;
}

type SellerApiItem = {
  handle: string;
  name: string;
  photo?: string | null;
  city?: string | null;
  product_count?: number;
};

export const getSellers = async (): Promise<SellerListItem[]> => {
  return sdk.client
    .fetch<{ sellers: SellerApiItem[] }>('/store/seller', {
      cache: 'no-cache'
    })
    .then(({ sellers }) => {
      const mapped: SellerListItem[] = (sellers ?? []).map(v => ({
        handle: v.handle,
        name: v.name,
        photo_url: v.photo ?? null,
        city: v.city ?? null,
        product_count: v.product_count ?? 0
      }));

      return mapped.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
    })
    .catch(() => []);
};

export const getSellerByHandle = async (handle: string) => {
  return sdk.client
    .fetch<{ seller: SellerProps }>(`/store/seller/${handle}`, {
      query: {
        fields:
          '+created_at,+email,+phone,+social_links,+reviews.seller.name,+reviews.rating,+reviews.customer_note,+reviews.seller_note,+reviews.created_at,+reviews.updated_at,+reviews.customer.first_name,+reviews.customer.last_name'
      },
      cache: 'no-cache'
    })
    .then(({ seller }) => {
      const response = {
        ...seller,
        reviews:
          seller.reviews
            ?.filter(item => item !== null)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? []
      };

      return response as SellerProps;
    })
    .catch(() => null);
};
