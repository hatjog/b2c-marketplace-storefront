'use server';

import type { HttpTypes } from '@medusajs/types';

import { sdk } from '../config';
import { getAuthHeaders } from './cookies';

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders())
  };

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(`/store/payment-providers`, {
      method: 'GET',
      query: { region_id: regionId },
      headers,
      cache: 'no-cache'
    })
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => {
        return a.id > b.id ? 1 : -1;
      })
    )
    .catch(() => {
      return null;
    });
};
