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
    const first = getCheckoutPaymentIdempotencyKey();
    const second = getCheckoutPaymentIdempotencyKey();

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
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
});
