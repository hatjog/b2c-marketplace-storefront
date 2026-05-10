'use server';

import { fetchQuery } from '../config';
import { getAuthHeaders } from './cookies';

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
