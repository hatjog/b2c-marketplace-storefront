'use server';

import { fetchQuery } from '../config';
import { getAuthHeaders } from './cookies';

export type StoreReviewRecord = {
  id: string;
  rating: number;
  customer_note: string | null;
  seller_note: string | null;
  created_at: string;
  updated_at?: string | null;
  locale?: string | null;
  provenance?: string | null;
  provenance_tag?: string | null;
  metadata?: {
    gp?: {
      locale?: string | null;
      provenance?: string | null;
      provenance_tag?: string | null;
    } | null;
    locale?: string | null;
    provenance?: string | null;
    provenance_tag?: string | null;
  } | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  seller?: {
    id?: string | null;
    name?: string | null;
    handle?: string | null;
  } | null;
};

export type StoreReviewsResponse = {
  reviews: StoreReviewRecord[];
  count: number;
  offset: number;
  limit: number;
  average_rating: number;
  rating_count: number;
};

type ReviewQuery = {
  seller_id?: string;
  product_id?: string;
  limit?: number;
};

const REVIEW_FIELDS = [
  '*',
  '+customer.id',
  '+customer.first_name',
  '+customer.last_name',
  '+seller.id',
  '+seller.name',
  '+seller.handle'
].join(',');

export async function getReviews() {
  const headers = {
    ...(await getAuthHeaders())
  };

  const res = await fetchQuery('/store/reviews', {
    headers,
    method: 'GET',
    query: { fields: '*seller,+customer.id,+order_id' }
  });

  return res;
}

export async function getStoreReviews(query: ReviewQuery = {}): Promise<StoreReviewsResponse> {
  const headers = {
    ...(await getAuthHeaders())
  };

  const res = await fetchQuery('/store/reviews', {
    headers,
    method: 'GET',
    query: {
      fields: REVIEW_FIELDS,
      limit: query.limit ?? 50,
      ...(query.seller_id ? { seller_id: query.seller_id } : {}),
      ...(query.product_id ? { product_id: query.product_id } : {})
    }
  });

  if (!res.ok || !res.data) {
    return {
      reviews: [],
      count: 0,
      offset: 0,
      limit: query.limit ?? 50,
      average_rating: 0,
      rating_count: 0
    };
  }

  const data = res.data as Partial<StoreReviewsResponse>;

  return {
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    count: typeof data.count === 'number' ? data.count : 0,
    offset: typeof data.offset === 'number' ? data.offset : 0,
    limit: typeof data.limit === 'number' ? data.limit : (query.limit ?? 50),
    average_rating: typeof data.average_rating === 'number' ? data.average_rating : 0,
    rating_count: typeof data.rating_count === 'number' ? data.rating_count : 0
  };
}

export async function getSellerReviews(sellerId: string): Promise<StoreReviewsResponse> {
  return getStoreReviews({ seller_id: sellerId, limit: 100 });
}

export async function getProductReviews(productId: string): Promise<StoreReviewsResponse> {
  return getStoreReviews({ product_id: productId, limit: 100 });
}
