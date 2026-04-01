import type { SellerProps } from '@/types/seller';

import { sdk } from '../config';

export interface SellerListItem {
  handle: string;
  name: string;
  photo_url: string | null;
  city: string | null;
  product_count: number;
}

type VendorApiItem = {
  handle: string;
  name: string;
  photo_url?: string | null;
  photo?: string | null;
  city?: string | null;
  product_count?: number;
  products?: unknown[];
};

export const getSellers = async (): Promise<SellerListItem[]> => {
  return sdk.client
    .fetch<{ vendors: VendorApiItem[] }>('/store/vendors', {
      cache: 'no-cache'
    })
    .then(({ vendors }) => {
      const mapped: SellerListItem[] = (vendors ?? []).map(v => ({
        handle: v.handle,
        name: v.name,
        photo_url: v.photo_url ?? v.photo ?? null,
        city: v.city ?? null,
        product_count: v.product_count ?? v.products?.length ?? 0
      }));

      return mapped
        .filter(s => s.product_count > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
    })
    .catch(() => []);
};

export const getSellerByHandle = async (handle: string) => {
  return sdk.client
    .fetch<{ seller: SellerProps }>(`/store/seller/${handle}`, {
      query: {
        fields:
          '+created_at,+email,+phone,+reviews.seller.name,+reviews.rating,+reviews.customer_note,+reviews.seller_note,+reviews.created_at,+reviews.updated_at,+reviews.customer.first_name,+reviews.customer.last_name'
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
