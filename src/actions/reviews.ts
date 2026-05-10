'use server';

import { revalidatePath } from 'next/cache';

import { getAuthHeaders } from '@/lib/data/cookies';
import { resolveMedusaBackendUrl } from '@/lib/env';

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

export async function createReview(review: any) {
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
}
