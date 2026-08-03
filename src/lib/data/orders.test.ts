import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listOrders } from './orders';

const mockFetch = vi.fn();

vi.mock('../config', () => ({
  sdk: {
    client: {
      fetch: (...args: unknown[]) => mockFetch(...args)
    }
  }
}));

vi.mock('./cookies', () => ({
  getAuthHeaders: vi.fn(async () => ({ authorization: 'Bearer test-token' })),
  getCacheOptions: vi.fn(async () => ({}))
}));

vi.mock('../env', () => ({
  resolveMedusaBackendUrl: () => 'http://localhost:9002'
}));

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  order_group: { id: 'group-1' },
  total: 1000,
  currency_code: 'pln',
  ...overrides
});

describe('listOrders', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns an empty array when backend returns no orders', async () => {
    mockFetch.mockResolvedValue({ orders: [] });

    await expect(listOrders()).resolves.toEqual([]);
  });

  it('drops orders without order_group instead of breaking the account page', async () => {
    mockFetch.mockResolvedValue({
      orders: [
        makeOrder({ id: 'order-with-group' }),
        makeOrder({ id: 'orphan-order', order_group: null })
      ]
    });

    const result = await listOrders();

    expect(result.map(order => order.id)).toEqual(['order-with-group']);
  });

  it('treats empty-account 404 responses as an empty order list', async () => {
    mockFetch.mockRejectedValue({
      response: {
        status: 404,
        data: { message: 'Orders not found' }
      }
    });

    await expect(listOrders()).resolves.toEqual([]);
  });

  it('still fails loud for non-empty-list backend errors', async () => {
    mockFetch.mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Database unavailable' },
        headers: {}
      },
      config: {
        url: '/store/orders',
        baseURL: 'http://localhost:9002'
      }
    });

    await expect(listOrders()).rejects.toThrow(/Database unavailable/);
  });
});
