'use server';

import { revalidatePath } from 'next/cache';

import { getAuthHeaders } from '@/lib/data/cookies';
import { resolveMedusaBackendUrl } from '@/lib/env';
import { localeAwareFetch, localePath } from '@/lib/sdk/locale-interceptor';

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

export async function createReview(review: any) {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
  };

  const response = await localeAwareFetch(`${MEDUSA_BACKEND_URL}/store/reviews`, {
    headers,
    method: 'POST',
    body: JSON.stringify(review)
  }).then(async res => {
    revalidatePath(await localePath('/user/reviews'));
    revalidatePath(await localePath('/user/reviews/written'));
    return res;
  });

  return response.json();
}
