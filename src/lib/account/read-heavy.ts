import type { HttpTypes } from '@medusajs/types';

import type { MercurOrderWithOrderGroup, OrderGroup } from '@/types/medusa-extensions';
import type { Wishlist } from '@/types/wishlist';

import { retrieveCustomer } from '../data/customer';
import { getReturns, listOrders, retrieveOrderGroup } from '../data/orders';
import { getRegion } from '../data/regions';
import { getUserWishlists } from '../data/wishlist';

export type CollectionState = 'ok' | 'access_denied' | 'unavailable' | 'failed';
export type SemanticTone = 'paid' | 'pending' | 'failed' | 'refunded';

export interface CollectionResult<T> {
  state: CollectionState;
  data: T;
}

export interface OrderGroupSummary {
  id: string;
  displayId: string;
  createdAt: string | null;
  total: number;
  currencyCode: string;
  itemCount: number;
  statuses: string[];
  orders: MercurOrderWithOrderGroup[];
}

export interface TimelineEvent {
  id: string;
  labelKey: string;
  detailKey: string;
  at: string | null;
  tone: SemanticTone;
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function isAccessError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

function isUnavailableError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 409 || status === 422 || status === 503;
}

export function toDisplayName(customer: HttpTypes.StoreCustomer | null) {
  if (!customer) {
    return null;
  }

  const name = `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();
  return name || customer.email;
}

export function formatAccountDate(value: string | Date | null | undefined, locale: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const bcp47: Record<string, string> = {
    pl: 'pl-PL',
    en: 'en-GB',
    ua: 'uk-UA',
    de: 'de-DE'
  };

  return new Intl.DateTimeFormat(bcp47[locale] ?? 'pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Warsaw'
  }).format(date);
}

export function formatAccountCurrency(amount: number, currencyCode: string, locale: string) {
  const bcp47: Record<string, string> = {
    pl: 'pl-PL',
    en: 'en-GB',
    ua: 'uk-UA',
    de: 'de-DE'
  };

  return new Intl.NumberFormat(bcp47[locale] ?? 'pl-PL', {
    style: 'currency',
    currency: (currencyCode || 'PLN').toUpperCase()
  }).format((amount || 0) / 100);
}

export function toneToBadgeClass(tone: SemanticTone) {
  switch (tone) {
    case 'paid':
      return 'bg-positive-secondary text-positive border border-positive';
    case 'pending':
      return 'bg-warning-secondary text-warning border border-warning';
    case 'failed':
      return 'bg-negative-secondary text-negative border border-negative';
    case 'refunded':
      return 'bg-secondary text-primary border border-primary';
    default:
      return 'bg-secondary text-primary border border-primary';
  }
}

export function orderStatusToTone(status: string | null | undefined): SemanticTone {
  const normalized = String(status ?? '').toLowerCase();

  if (normalized.includes('refund') || normalized.includes('return')) {
    return 'refunded';
  }

  if (normalized.includes('cancel') || normalized.includes('fail')) {
    return 'failed';
  }

  if (normalized.includes('paid') || normalized.includes('complete') || normalized.includes('fulfilled')) {
    return 'paid';
  }

  return 'pending';
}

export function groupOrdersByOrderGroup(orders: MercurOrderWithOrderGroup[]): OrderGroupSummary[] {
  const grouped = orders.reduce<Record<string, MercurOrderWithOrderGroup[]>>((acc, order) => {
    const key = order.order_group.id;
    acc[key] ??= [];
    acc[key].push(order);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([id, bucket]) => {
      const first = bucket[0];
      const total = bucket.reduce((sum, order) => sum + (order.total ?? 0), 0);

      return {
        id,
        displayId: String(first.order_group.display_id ?? id),
        createdAt: toIsoString(first.order_group.created_at ?? first.created_at),
        total,
        currencyCode: first.currency_code ?? first.order_group.payment_collection?.currency_code ?? 'PLN',
        itemCount: bucket.reduce((sum, order) => sum + (order.items?.length ?? 0), 0),
        statuses: Array.from(new Set(bucket.map(order => order.status).filter(Boolean) as string[])),
        orders: bucket
      };
    })
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

export async function loadOrderGroups({
  limit = 25,
  offset = 0
}: {
  limit?: number;
  offset?: number;
} = {}): Promise<CollectionResult<OrderGroupSummary[]>> {
  const customer = await retrieveCustomer();
  if (!customer) {
    return { state: 'access_denied', data: [] };
  }

  try {
    const orders = await listOrders(limit, offset);
    return { state: 'ok', data: groupOrdersByOrderGroup(orders) };
  } catch (error) {
    if (isAccessError(error)) {
      return { state: 'access_denied', data: [] };
    }
    if (isUnavailableError(error)) {
      return { state: 'unavailable', data: [] };
    }
    return { state: 'failed', data: [] };
  }
}

export async function loadOrderGroupDetail(id: string): Promise<CollectionResult<OrderGroup | null>> {
  const customer = await retrieveCustomer();
  if (!customer) {
    return { state: 'access_denied', data: null };
  }

  try {
    const orderGroup = await retrieveOrderGroup(id);
    return { state: 'ok', data: orderGroup };
  } catch (error) {
    if (isAccessError(error)) {
      return { state: 'access_denied', data: null };
    }
    if (isUnavailableError(error)) {
      return { state: 'unavailable', data: null };
    }
    return { state: 'failed', data: null };
  }
}

export async function loadReturns(): Promise<CollectionResult<any[]>> {
  const customer = await retrieveCustomer();
  if (!customer) {
    return { state: 'access_denied', data: [] };
  }

  try {
    const response = await getReturns();
    return { state: 'ok', data: response.order_return_requests ?? [] };
  } catch (error) {
    if (isAccessError(error)) {
      return { state: 'access_denied', data: [] };
    }
    if (isUnavailableError(error)) {
      return { state: 'unavailable', data: [] };
    }
    return { state: 'failed', data: [] };
  }
}

export async function loadWishlist(countryCode: string): Promise<CollectionResult<Wishlist>> {
  const customer = await retrieveCustomer();
  if (!customer) {
    return { state: 'access_denied', data: { products: [] } };
  }

  try {
    const region = await getRegion(countryCode);
    const wishlist = await getUserWishlists({
      countryCode,
      regionId: region?.id,
      suppressErrors: false
    });

    return { state: 'ok', data: wishlist };
  } catch (error) {
    if (isAccessError(error)) {
      return { state: 'access_denied', data: { products: [] } };
    }
    if (isUnavailableError(error)) {
      return { state: 'unavailable', data: { products: [] } };
    }
    return { state: 'failed', data: { products: [] } };
  }
}

export function buildOrderTimeline(orderGroup: OrderGroup | null): TimelineEvent[] {
  if (!orderGroup?.orders?.length) {
    return [];
  }

  const primaryOrder = [...orderGroup.orders].sort((left, right) => {
    return new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime();
  })[0];

  return [
    {
      id: 'placed',
      labelKey: 'timeline.placed.label',
      detailKey: 'timeline.placed.detail',
      at: toIsoString(primaryOrder.created_at),
      tone: 'paid'
    },
    {
      id: 'payment',
      labelKey: 'timeline.payment.label',
      detailKey: primaryOrder.payment_status === 'captured' ? 'timeline.payment.detail_paid' : 'timeline.payment.detail_pending',
      at: toIsoString(primaryOrder.updated_at ?? primaryOrder.created_at),
      tone: primaryOrder.payment_status === 'captured' ? 'paid' : 'pending'
    },
    {
      id: 'fulfillment',
      labelKey: 'timeline.fulfillment.label',
      detailKey:
        primaryOrder.fulfillment_status === 'fulfilled'
          ? 'timeline.fulfillment.detail_ready'
          : 'timeline.fulfillment.detail_pending',
      at: toIsoString(primaryOrder.updated_at),
      tone: primaryOrder.fulfillment_status === 'fulfilled' ? 'paid' : 'pending'
    },
    {
      id: 'voucher_handoff',
      labelKey: 'timeline.voucher_handoff.label',
      detailKey: 'timeline.voucher_handoff.detail',
      at: toIsoString(primaryOrder.updated_at ?? primaryOrder.created_at),
      tone: orderStatusToTone(primaryOrder.status)
    }
  ];
}
