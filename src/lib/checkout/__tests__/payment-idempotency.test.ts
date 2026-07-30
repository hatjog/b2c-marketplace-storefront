import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeCheckoutCartHash,
  getCheckoutPaymentIdempotencyKey,
  resetCheckoutPaymentIdempotencyKey
} from '../payment-idempotency';

describe('payment idempotency key', () => {
  afterEach(() => {
    resetCheckoutPaymentIdempotencyKey();
    vi.restoreAllMocks();
  });

  it('keeps one UUID in sessionStorage for the checkout session', () => {
    const first = getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe');
    const second = getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe');

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not reuse a Stripe idempotency key across carts', () => {
    const first = getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe');
    const second = getCheckoutPaymentIdempotencyKey('cart_2', 'hash_1', 'pp_stripe');

    expect(first).not.toBe(second);
  });

  it('resets the completed cart key on the real checkout lifecycle boundary', () => {
    const first = getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe');
    resetCheckoutPaymentIdempotencyKey('cart_1');

    expect(getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe')).not.toBe(first);
  });

  it('changes the Stripe key when request parameters change in the same cart', () => {
    const base = getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe');

    expect(getCheckoutPaymentIdempotencyKey('cart_1', 'hash_2', 'pp_stripe')).not.toBe(base);
    expect(getCheckoutPaymentIdempotencyKey('cart_1', 'hash_1', 'pp_stripe_blik')).not.toBe(base);
  });

  it('hashes checkout cart fingerprints deterministically', async () => {
    const first = await computeCheckoutCartHash({
      id: 'cart_1',
      currency_code: 'PLN',
      total: 19900,
      item_total: 19000,
      shipping_total: 900,
      tax_total: 0
    });
    const second = await computeCheckoutCartHash({
      tax_total: 0,
      shipping_total: 900,
      item_total: 19000,
      total: 19900,
      currency_code: 'PLN',
      id: 'cart_1'
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps a non-empty deterministic fingerprint without Web Crypto', async () => {
    const subtle = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: undefined });
    try {
      const first = await computeCheckoutCartHash({ id: 'cart_1', total: 19900 });
      const second = await computeCheckoutCartHash({ id: 'cart_1', total: 19900 });
      expect(first).toBe(second);
      expect(first).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: subtle });
    }
  });
});
