'use server';

import type { HttpTypes } from '@medusajs/types';
import { revalidatePath } from 'next/cache';

import { fetchQuery } from '../config';
import { resolveMedusaBackendUrl } from '../env';
import { getAuthHeaders } from './cookies';
import type { Order } from './reviews.shared';

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

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

export type OrderReview = {
  created_at?: string | Date | null;
  customer_note?: string | null;
  rating?: number | null;
};

const getReviews = async () => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const res = await fetchQuery('/store/reviews', {
    headers,
    method: 'GET',
    query: { fields: '*seller,+customer.id,+order_id' }
  });

  return res;
};

const createReview = async (review: any) => {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
  };

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/reviews`, {
    headers,
    method: 'POST',
    body: JSON.stringify(review)
  }).then(res => {
    revalidatePath('/user/reviews');
    revalidatePath('/user/reviews/written');
    return res;
  });

  return response.json();
};

export { getReviews, createReview };
