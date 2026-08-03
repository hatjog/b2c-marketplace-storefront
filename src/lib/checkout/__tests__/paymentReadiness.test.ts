import { describe, expect, it } from 'vitest';

import { isCheckoutPaymentReady } from '../paymentReadiness';

const addressedCart = {
  shipping_address: { address_1: 'Testowa 1' },
  billing_address: { address_1: 'Testowa 1' },
  email: 'buyer@example.com'
};

describe('isCheckoutPaymentReady', () => {
  it('allows payment when checkout identity/address data and per-seller shipping coverage are complete', () => {
    expect(
      isCheckoutPaymentReady({
        cart: addressedCart,
        shippingComplete: true
      })
    ).toBe(true);
  });

  it('blocks payment before charge when at least one seller has missing shipping coverage', () => {
    expect(
      isCheckoutPaymentReady({
        cart: addressedCart,
        shippingComplete: false
      })
    ).toBe(false);
  });

  it('blocks payment when required buyer checkout data is missing', () => {
    expect(
      isCheckoutPaymentReady({
        cart: {
          ...addressedCart,
          email: ''
        },
        shippingComplete: true
      })
    ).toBe(false);
  });

  it('blocks payment when shipping_address is missing', () => {
    expect(
      isCheckoutPaymentReady({
        cart: { ...addressedCart, shipping_address: undefined },
        shippingComplete: true
      })
    ).toBe(false);
  });

  it('blocks payment when billing_address is missing', () => {
    expect(
      isCheckoutPaymentReady({
        cart: { ...addressedCart, billing_address: undefined },
        shippingComplete: true
      })
    ).toBe(false);
  });

  it('blocks payment when cart is null (fetch not yet resolved)', () => {
    expect(
      isCheckoutPaymentReady({ cart: null, shippingComplete: true })
    ).toBe(false);
  });
});
