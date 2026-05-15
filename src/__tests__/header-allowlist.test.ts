import { describe, expect, it } from 'vitest';

import {
  INTERNAL_MULTITENANT_HEADERS,
  isStripeHost,
  isStripeUrl,
  stripInternalHeadersForThirdParty
} from '@/lib/security/header-allowlist';

/**
 * Story 1.6 (FR1.7 / AC3) — third-party header allowlist contract.
 *
 * Proves the suffix-safe Stripe host match and that internal multi-tenant
 * headers are stripped for Stripe hosts but preserved for the Medusa backend,
 * including the `stripe.com.evil.example` bypass-attempt security case.
 */

const STRIPE_HOSTS = [
  'stripe.com',
  'js.stripe.com',
  'api.stripe.com',
  'm.stripe.com',
  'r.stripe.com',
  'q.stripe.com',
  'hooks.stripe.com'
];

const NON_STRIPE_HOSTS = [
  'stripe.com.evil.example',
  'notstripe.com',
  'evilstripe.com',
  'stripe.evil.com',
  'localhost',
  'api.mercurjs.com'
];

describe('isStripeHost — suffix-safe match (AC3 security)', () => {
  it.each(STRIPE_HOSTS)('treats %s as a Stripe host', host => {
    expect(isStripeHost(host)).toBe(true);
  });

  it.each(NON_STRIPE_HOSTS)('treats %s as NON-Stripe (no bypass)', host => {
    expect(isStripeHost(host)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isStripeHost('JS.STRIPE.COM')).toBe(true);
    expect(isStripeHost('Stripe.Com')).toBe(true);
  });

  it('does NOT use naive substring matching', () => {
    // `includes('stripe')` would wrongly accept these.
    expect(isStripeHost('stripe.com.evil.example')).toBe(false);
    expect(isStripeHost('mystripe.com')).toBe(false);
  });
});

describe('isStripeUrl', () => {
  it('detects Stripe origins from a full URL', () => {
    expect(isStripeUrl('https://js.stripe.com/v3')).toBe(true);
    expect(isStripeUrl('https://api.stripe.com/v1/payment_intents')).toBe(true);
  });

  it('treats the Medusa backend as NON-Stripe', () => {
    expect(isStripeUrl('http://localhost:9002/store/carts')).toBe(false);
    expect(isStripeUrl('https://api.mercurjs.com/store/products')).toBe(false);
  });

  it('treats an unparseable URL as NON-Stripe (fail-closed to default behaviour)', () => {
    expect(isStripeUrl('not a url')).toBe(false);
    expect(isStripeUrl('')).toBe(false);
  });

  it('does NOT misclassify a bypass host as Stripe', () => {
    expect(isStripeUrl('https://stripe.com.evil.example/v3')).toBe(false);
  });
});

describe('stripInternalHeadersForThirdParty — AC3 contract', () => {
  const internalHeaders = {
    'Content-Type': 'application/json',
    'x-market-id': 'bonbeauty-pl',
    'x-publishable-api-key': 'pk_test_123',
    'x-customer-id': 'cus_abc'
  };

  it('strips ALL internal headers for a Stripe URL', () => {
    const result = stripInternalHeadersForThirdParty(
      'https://api.stripe.com/v1/payment_intents',
      internalHeaders
    );
    expect(result['x-market-id']).toBeUndefined();
    expect(result['x-publishable-api-key']).toBeUndefined();
    expect(result['x-customer-id']).toBeUndefined();
    // Non-internal headers survive.
    expect(result['Content-Type']).toBe('application/json');
  });

  it('strips internal headers regardless of header-name casing', () => {
    const result = stripInternalHeadersForThirdParty('https://js.stripe.com/v3', {
      'Content-Type': 'application/json',
      'X-Market-Id': 'bonbeauty-pl',
      'X-Publishable-Api-Key': 'pk_test_123'
    });
    expect(result['X-Market-Id']).toBeUndefined();
    expect(result['X-Publishable-Api-Key']).toBeUndefined();
    expect(result['Content-Type']).toBe('application/json');
  });

  it('PRESERVES internal headers for the Medusa backend (no market-isolation regression)', () => {
    const result = stripInternalHeadersForThirdParty(
      'http://localhost:9002/store/carts/cart_1/promotions',
      internalHeaders
    );
    expect(result['x-market-id']).toBe('bonbeauty-pl');
    expect(result['x-publishable-api-key']).toBe('pk_test_123');
    expect(result['x-customer-id']).toBe('cus_abc');
  });

  it('SECURITY: stripe.com.evil.example is NOT treated as Stripe — headers preserved (no false strip, no bypass)', () => {
    const result = stripInternalHeadersForThirdParty(
      'https://stripe.com.evil.example/v3',
      internalHeaders
    );
    // It is not a Stripe host, so default behaviour applies (headers kept).
    // The security guarantee is that it is NOT misclassified as trusted Stripe.
    expect(result['x-market-id']).toBe('bonbeauty-pl');
    expect(isStripeUrl('https://stripe.com.evil.example/v3')).toBe(false);
  });

  it('does not mutate the input headers object', () => {
    const input = { ...internalHeaders };
    stripInternalHeadersForThirdParty('https://js.stripe.com/v3', input);
    expect(input['x-market-id']).toBe('bonbeauty-pl');
  });

  it('exposes the canonical lowercase internal header list', () => {
    expect(INTERNAL_MULTITENANT_HEADERS).toEqual([
      'x-market-id',
      'x-publishable-api-key',
      'x-customer-id'
    ]);
  });
});
