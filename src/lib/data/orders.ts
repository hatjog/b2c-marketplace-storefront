'use server';

import type { HttpTypes } from '@medusajs/types';

import type { MercurOrder, MercurOrderWithOrderGroup, OrderGroup } from '@/types/medusa-extensions';

import { sdk } from '../config';
import { resolveMedusaBackendUrl } from '../env';
import medusaError from '../helpers/medusa-error';
import { getAuthHeaders, getCacheOptions } from './cookies';

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

export const retrieveOrderGroup = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders())
  };

  return sdk.client
    .fetch<{ order_group: OrderGroup }>(`/store/order-groups/${id}`, {
      method: 'GET',
      headers,
      cache: 'no-cache'
    })
    .then(({ order_group }) => order_group)
    .catch(err => medusaError(err));
};

export const retrieveOrder = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const next = {
    ...(await getCacheOptions('orders'))
  };

  return sdk.client
    .fetch<{ order: MercurOrder }>(`/store/orders/${id}`, {
      method: 'GET',
      query: {
        fields:
          '*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product,*seller,*order_group'
      },
      headers,
      next,
      cache: 'force-cache'
    })
    .then(({ order }) => order)
    .catch(err => medusaError(err));
};

export const createReturnRequest = async (data: any) => {
  const headers = {
    ...(await getAuthHeaders()),
    'Content-Type': 'application/json',
    'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
  };

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/return-request`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
    .then(async res => await res.json())
    .catch(err => medusaError(err));

  return response;
};

export const getReturns = async () => {
  const headers = await getAuthHeaders();

  return sdk.client
    .fetch<{
      order_return_requests: Array<any>;
    }>(`/store/return-request`, {
      method: 'GET',
      headers,
      cache: 'force-cache',
      query: { fields: '*line_items.reason_id' }
    })
    .then(res => res)
    .catch(err => medusaError(err));
};

export type ReturnShippingOption = HttpTypes.StoreCartShippingOption & {
  /** Return-option-specific fields from Medusa return endpoint (superset of StoreCartShippingOption). */
  [key: string]: unknown;
};

export const retriveReturnMethods = async (order_id: string): Promise<ReturnShippingOption[]> => {
  const headers = await getAuthHeaders();

  return sdk.client
    .fetch<{
      shipping_options: ReturnShippingOption[];
    }>(`/store/shipping-options/return?order_id=${order_id}`, {
      method: 'GET',
      headers,
      cache: 'no-cache'
    })
    .then(({ shipping_options }) => shipping_options)
    .catch(() => []);
};

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
): Promise<MercurOrderWithOrderGroup[]> => {
  const headers = {
    ...(await getAuthHeaders())
  };

  const next = {
    ...(await getCacheOptions('orders'))
  };

  const hasOrderGroup = (order: MercurOrder): order is MercurOrderWithOrderGroup =>
    Boolean(order.order_group?.id);

  return sdk.client
    .fetch<{
      orders: MercurOrder[];
    }>(`/store/orders`, {
      method: 'GET',
      query: {
        limit,
        offset,
        order: '-created_at',
        fields:
          '*items,+items.metadata,*items.variant,*items.product,*seller,*reviews,*order_group,shipping_total,total,created_at',
        ...filters
      },
      headers,
      next,
      cache: 'no-cache'
    })
    .then(({ orders }) => (orders ?? []).filter(hasOrderGroup))
    .catch(err => {
      const status = err?.response?.status;
      const message = String(err?.response?.data?.message ?? err?.message ?? '');
      const emptyOrdersResponse =
        status === 404 || status === 204 || /no orders|orders not found|not found/i.test(message);

      if (emptyOrdersResponse) {
        return [];
      }

      return medusaError(err);
    });
};

export const createTransferRequest = async (
  state: {
    success: boolean;
    error: string | null;
    order: HttpTypes.StoreOrder | null;
  },
  formData: FormData
): Promise<{
  success: boolean;
  error: string | null;
  order: HttpTypes.StoreOrder | null;
}> => {
  const id = formData.get('order_id') as string;

  if (!id) {
    return { success: false, error: 'Order ID is required', order: null };
  }

  const headers = await getAuthHeaders();

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: 'id, email'
      },
      headers
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch(err => ({ success: false, error: err.message, order: null }));
};

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders();

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch(err => ({ success: false, error: err.message, order: null }));
};

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders();

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch(err => ({ success: false, error: err.message, order: null }));
};

export const retrieveReturnReasons = async () => {
  const headers = await getAuthHeaders();

  return sdk.client
    .fetch<{
      return_reasons: Array<HttpTypes.StoreReturnReason>;
    }>(`/store/return-reasons`, {
      method: 'GET',
      headers,
      cache: 'force-cache'
    })
    .then(({ return_reasons }) => return_reasons)
    .catch(err => medusaError(err));
};
