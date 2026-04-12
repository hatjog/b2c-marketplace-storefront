'use server';

import type { HttpTypes } from '@medusajs/types';

import type { StoreCardShippingMethod } from '@/components/sections/CartShippingMethodsSection/CartShippingMethodsSection';
import { sdk } from '@/lib/config';

import { getAuthHeaders, getCacheOptions } from './cookies';

export const listCartShippingMethods = async (cartId: string, _is_return: boolean = false) => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const next = {
    ...(await getCacheOptions('fulfillment'))
  };

  return sdk.client
    .fetch<{ shipping_options: StoreCardShippingMethod[] | null }>(`/store/shipping-options`, {
      method: 'GET',
      query: {
        cart_id: cartId,
        fields:
          'seller.id,seller.name,+service_zone.fulfillment_set.type,*service_zone.fulfillment_set.location.address'
      },
      headers,
      next,
      cache: 'no-cache'
    })
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null;
    });
};

export const calculatePriceForShippingOption = async (
  optionId: string,
  cartId: string,
  data?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const next = {
    ...(await getCacheOptions('fulfillment'))
  };

  const body = { cart_id: cartId, data };

  if (data) {
    body.data = data;
  }

  return sdk.client
    .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
      `/store/shipping-options/${optionId}/calculate`,
      {
        method: 'POST',
        body,
        headers,
        next
      }
    )
    .then(({ shipping_option }) => shipping_option)
    .catch(() => {
      return null;
    });
};
