'use server';

import type { HttpTypes } from '@medusajs/types';

import type {
  AvailableShippingMethod,
  StoreCardShippingMethod
} from '@/components/sections/CartShippingMethodsSection/CartShippingMethodsSection';
import { sdk } from '@/lib/config';

import { getAuthHeaders, getCacheOptions } from './cookies';

export const listCartShippingMethods = async (
  cartId: string,
  _is_return: boolean = false
): Promise<AvailableShippingMethod[] | null> => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const next = {
    ...(await getCacheOptions('fulfillment'))
  };

  return sdk.client
    .fetch<
      | { shipping_options: StoreCardShippingMethod[] | null }
      | { shipping_options?: { shipping_options?: StoreCardShippingMethod[] | null } | null }
    >(`/store/shipping-options`, {
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
    .then((body) => {
      const flattenSellerMap = (candidate: unknown): AvailableShippingMethod[] | null => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
          return null;
        }

        const values = Object.values(candidate as Record<string, unknown>);
        if (values.length === 0 || !values.every(Array.isArray)) {
          return null;
        }

        return values.flat() as AvailableShippingMethod[];
      };

      if (
        Array.isArray(
          (body as { shipping_options?: StoreCardShippingMethod[] | null }).shipping_options
        )
      ) {
        return (body as { shipping_options: AvailableShippingMethod[] }).shipping_options;
      }

      const nested = (
        body as {
          shipping_options?: { shipping_options?: StoreCardShippingMethod[] | null } | null;
        }
      ).shipping_options;

      const sellerMap = flattenSellerMap(nested);
      if (sellerMap) {
        return sellerMap;
      }

      if (Array.isArray(nested?.shipping_options)) {
        return nested.shipping_options as AvailableShippingMethod[];
      }

      const nestedSellerMap = flattenSellerMap(nested?.shipping_options);
      if (nestedSellerMap) {
        return nestedSellerMap;
      }

      return null;
    })
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
