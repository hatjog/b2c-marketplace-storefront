import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CheckoutAddressPayload } from '@/lib/checkout/address-payload';

import { setAddresses } from './cart';

const mockCartUpdate = vi.fn();
const mockGetCartId = vi.fn();
const mockGetAuthHeaders = vi.fn();
const mockGetCacheTag = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args)
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}));

vi.mock('../config', () => ({
  fetchQuery: vi.fn(),
  sdk: {
    store: {
      cart: {
        update: (...args: unknown[]) => mockCartUpdate(...args)
      }
    }
  }
}));

vi.mock('../env', () => ({
  resolveMedusaBackendUrl: () => 'http://localhost:9002'
}));

vi.mock('./cookies', () => ({
  getAuthHeaders: (...args: unknown[]) => mockGetAuthHeaders(...args),
  getCacheOptions: vi.fn(async () => ({})),
  getCacheTag: (...args: unknown[]) => mockGetCacheTag(...args),
  getCartId: (...args: unknown[]) => mockGetCartId(...args),
  removeCartId: vi.fn(),
  setCartId: vi.fn()
}));

vi.mock('./regions', () => ({
  getRegion: vi.fn()
}));

vi.mock('@/lib/helpers/asset-reference', () => ({
  resolveStorefrontImageSrc: (value: unknown) => value
}));

vi.mock('@/lib/helpers/market-filter', () => ({
  getMarketId: () => 'bonbeauty'
}));

vi.mock('@/lib/helpers/medusa-error', () => ({
  default: (err: unknown) => {
    throw err instanceof Error ? err : new Error('Medusa error');
  }
}));

vi.mock('../security/flagAtomicCheck', () => ({
  FlagDriftError: class FlagDriftError extends Error {},
  snapshotFlagAtCartStart: vi.fn(() => ({ flag: false, ts: '2026-05-11T00:00:00Z' })),
  verifyFlagUnchanged: vi.fn()
}));

const payload: CheckoutAddressPayload = {
  shipping_address: {
    first_name: 'Anna',
    last_name: 'Nowak',
    address_1: 'Testowa 17/5',
    address_2: '',
    company: '',
    postal_code: '00-001',
    city: 'Warszawa',
    country_code: 'pl',
    province: '',
    phone: '+48600000000'
  },
  email: 'anna@example.com',
  same_as_billing: true
};

describe('setAddresses', () => {
  beforeEach(() => {
    mockCartUpdate.mockReset();
    mockGetCartId.mockResolvedValue('cart_123');
    mockGetAuthHeaders.mockResolvedValue({ authorization: 'Bearer test-token' });
    mockGetCacheTag.mockResolvedValue('carts');
    mockRevalidatePath.mockReset();
    mockRevalidateTag.mockReset();
  });

  it('updates cart addresses from a POJO payload', async () => {
    mockCartUpdate.mockResolvedValue({ cart: { id: 'cart_123' } });

    await expect(setAddresses(null, payload)).resolves.toBe('success');

    expect(mockCartUpdate).toHaveBeenCalledWith(
      'cart_123',
      {
        shipping_address: payload.shipping_address,
        billing_address: payload.shipping_address,
        email: 'anna@example.com'
      },
      {},
      { authorization: 'Bearer test-token' }
    );
    expect(mockRevalidateTag).toHaveBeenCalledWith('carts');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/cart');
  });

  it('returns a user-visible error when the cart is missing', async () => {
    mockGetCartId.mockResolvedValue(null);

    await expect(setAddresses(null, payload)).resolves.toBe(
      'No existing cart found when setting addresses'
    );
    expect(mockCartUpdate).not.toHaveBeenCalled();
  });
});
