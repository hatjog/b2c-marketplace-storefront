/**
 * Story 1.4 — lib/stripe/client.ts per-market resolution.
 *
 * Pokrywa: AC1 (paymentMethodTypes per D6 enabled_methods + graceful reject
 * unconfigured market), AC4 (per-market publishable key z env, NIE
 * hardcoded), F-NEW-H2 (uniform reject message, NIE market-specific).
 */
import { loadStripe } from '@stripe/stripe-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getEnabledPaymentMethodTypes,
  getPublishableKey,
  getStripePromise,
  isStripeEnabledMarket,
  PAYMENT_NOT_AVAILABLE_MESSAGE
} from '../client';

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn((key: string) => Promise.resolve({ __stripe: key }))
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('enabled markets matrix (Story 1.1 mirror, D10)', () => {
  it('bonbeauty is the only Stripe-enabled market in v1.8.0', () => {
    expect(isStripeEnabledMarket('bonbeauty')).toBe(true);
    for (const m of ['bonevent', 'bongarden', 'mercur', 'testmarketb']) {
      expect(isStripeEnabledMarket(m)).toBe(false);
    }
  });
});

describe('getEnabledPaymentMethodTypes — AC1 / D6', () => {
  it('returns 5 BonBeauty methods (card/blik/p24/apple_pay/google_pay) matching gp-config (F-CC1-007 fix)', () => {
    // v1.9.0 wf5 (closes CC-1 F-CC1-007): storefront-side list MUST match
    // GP/config/gp-dev/markets/bonbeauty/market.yaml#payments.stripe.enabled_methods.
    // Pre-v1.9.0 the storefront hardcoded only 3 methods and silently dropped
    // wallet methods (apple_pay/google_pay) from the PaymentElement.
    expect(getEnabledPaymentMethodTypes('bonbeauty')).toEqual([
      'card',
      'blik',
      'p24',
      'apple_pay',
      'google_pay',
    ]);
  });

  it('returns null (graceful reject) for unconfigured market', () => {
    expect(getEnabledPaymentMethodTypes('bonevent')).toBeNull();
  });
});

describe('getPublishableKey — AC4 per-market, no hardcoded secret', () => {
  it('prefers per-market env var over shared fallback', () => {
    vi.stubEnv('NEXT_PUBLIC_PAYLOAD_MARKET_ID', 'bonbeauty');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY_BONBEAUTY', 'pk_test_bonbeauty');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY', 'pk_test_shared');
    expect(getPublishableKey()).toBe('pk_test_bonbeauty');
  });

  it('falls back to shared NEXT_PUBLIC_STRIPE_KEY', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY_BONBEAUTY', '');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY', 'pk_test_shared');
    expect(getPublishableKey('bonbeauty')).toBe('pk_test_shared');
  });

  it('returns null for unconfigured market (no key leak)', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY', 'pk_test_shared');
    expect(getPublishableKey('bonevent')).toBeNull();
  });

  it('returns null when no key configured', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY_BONBEAUTY', '');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY', '');
    expect(getPublishableKey('bonbeauty')).toBeNull();
  });
});

describe('getStripePromise — AC4 graceful reject', () => {
  it('loads Stripe with resolved per-market key', async () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY', 'pk_test_shared');
    const promise = getStripePromise('bonbeauty');
    expect(promise).not.toBeNull();
    await promise;
    expect(loadStripe).toHaveBeenCalledWith('pk_test_shared');
  });

  it('returns null (no crash) for unconfigured market', () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_KEY', 'pk_test_shared');
    expect(getStripePromise('mercur')).toBeNull();
    expect(loadStripe).not.toHaveBeenCalled();
  });
});

describe('F-NEW-H2 uniform reject message', () => {
  it('is market-agnostic (NOT market-specific text)', () => {
    expect(PAYMENT_NOT_AVAILABLE_MESSAGE).toBe('Payment is not available for this market');
    expect(PAYMENT_NOT_AVAILABLE_MESSAGE).not.toMatch(/bonbeauty|bonevent|market_id/i);
  });
});
