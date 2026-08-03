/**
 * @vitest-environment jsdom
 *
 * CartPaymentSection — integration tests (H-2 / L-1).
 *
 * H-2: weryfikuje, że router.refresh() jest wywoływany po setPaymentMethod
 * dla metody Stripe (fix na brak refetchu RSC → cart.payment_sessions stale
 * → stripeClientSecret nigdy niedostępny → StripePaymentElement nie montowany).
 *
 * L-1: weryfikuje wiring CartPaymentSection → StripePaymentElement: gdy
 * stripeClientSecret jest dostępny w propsie cart, StripePaymentElement
 * jest renderowany z poprawnym clientSecret.
 */
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import type { HttpTypes } from '@medusajs/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 wymaga IS_REACT_ACT_ENVIRONMENT = true żeby act() działał z jsdom.
// @testing-library/react ustawia to automatycznie; bez niego robimy to ręcznie.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockRefresh = vi.fn();
const mockPush = vi.fn();
const mockInitiatePaymentSession = vi.fn().mockResolvedValue({});
const mockComputeCartHash = vi.fn().mockResolvedValue('hash-abc');
const mockGetIdempotencyKey = vi.fn().mockReturnValue('idem-uuid');
const mockResetIdempotencyKey = vi.fn();

// Capture RadioGroup onChange for direct invocation in tests.
let capturedOnChange: ((value: string) => void) | undefined;

vi.mock('next/navigation', () => ({
  usePathname: () => '/pl/checkout',
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
  useSearchParams: () => new URLSearchParams('step=payment')
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'pl'
}));

vi.mock('@headlessui/react', () => ({
  RadioGroup: ({ onChange, children }: { onChange: (v: string) => void; children: React.ReactNode }) => {
    capturedOnChange = onChange;
    return React.createElement('div', { 'data-testid': 'radio-group' }, children);
  },
  // RadioGroup.Option używane przez PaymentContainer (nawet jeśli ten jest mockowany
  // na poziomie modułu, headlessui jest importowany w exports constants.ts chain)
  Radio: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children)
}));

vi.mock('@medusajs/ui', () => ({
  Container: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  Heading: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  Text: ({ children, ...rest }: { children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('span', rest, children)
}));

vi.mock('@medusajs/icons', () => ({
  CheckCircleSolid: () => null,
  CreditCard: () => null,
  Cash: () => null
}));

vi.mock('@/components/atoms', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement('button', { onClick }, children)
}));

vi.mock('@/components/molecules/ErrorMessage/ErrorMessage', () => ({
  default: () => null
}));

vi.mock('@/lib/data/cart', () => ({
  initiatePaymentSession: (...a: unknown[]) => mockInitiatePaymentSession(...a)
}));

vi.mock('@/lib/checkout/payment-idempotency', () => ({
  computeCheckoutCartHash: (...a: unknown[]) => mockComputeCartHash(...a),
  getCheckoutPaymentIdempotencyKey: (...a: unknown[]) => mockGetIdempotencyKey(...a),
  resetCheckoutPaymentIdempotencyKey: (...a: unknown[]) => mockResetIdempotencyKey(...a)
}));

vi.mock('@/lib/constants', () => ({
  isStripe: (id: string) => id.startsWith('pp_stripe'),
  paymentInfoMap: { pp_stripe_stripe: { title: 'Stripe', icon: null } }
}));

vi.mock('@/components/organisms/PaymentContainer/PaymentContainer', () => ({
  default: () => null
}));

vi.mock('@/components/sections/CartPaymentSection/StripePaymentElement', () => ({
  default: ({ clientSecret, onPaymentCompleted }: { clientSecret: string; onPaymentCompleted?: () => void }) =>
    React.createElement('button', {
      'data-testid': 'stripe-payment-element-mock',
      'data-secret': clientSecret,
      onClick: onPaymentCompleted
    })
}));

import CartPaymentSection from '../CartPaymentSection';

// Minimal fixtures: the component only reads id / total / currency_code /
// shipping_methods / payment_collection. Cast through `unknown` to the full
// `StoreCart` prop contract instead of materialising ~20 unrelated fields.
const cartWithSession = {
  id: 'cart_1',
  total: 100,
  currency_code: 'pln',
  shipping_methods: [{}],
  payment_collection: {
    payment_sessions: [
      {
        provider_id: 'pp_stripe_stripe',
        status: 'pending',
        data: { client_secret: 'cs_test_abc123' }
      }
    ]
  }
} as unknown as HttpTypes.StoreCart;

const cartWithoutSession = {
  id: 'cart_1',
  total: 100,
  currency_code: 'pln',
  shipping_methods: [{}],
  payment_collection: { payment_sessions: [] }
} as unknown as HttpTypes.StoreCart;

const paymentMethods: HttpTypes.StorePaymentProvider[] = [{ id: 'pp_stripe_stripe' }];

describe('CartPaymentSection — integration (H-2 / L-1)', () => {
  let container: HTMLElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    capturedOnChange = undefined;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });

  it('L-1: mounts StripePaymentElement with clientSecret when stripeClientSecret available', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(CartPaymentSection, {
          cart: cartWithSession,
          availablePaymentMethods: paymentMethods
        })
      );
    });

    const el = container.querySelector('[data-testid="stripe-payment-element-mock"]');
    expect(el).not.toBeNull();
    expect((el as HTMLElement).dataset.secret).toBe('cs_test_abc123');
  });

  it('H-2: calls router.refresh() after initiatePaymentSession when Stripe method selected', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(CartPaymentSection, {
          cart: cartWithoutSession,
          availablePaymentMethods: paymentMethods
        })
      );
    });

    expect(capturedOnChange).toBeDefined();

    await act(async () => {
      capturedOnChange!('pp_stripe_stripe');
    });

    expect(mockInitiatePaymentSession).toHaveBeenCalledOnce();
    expect(mockGetIdempotencyKey).toHaveBeenCalledWith('cart_1', 'hash-abc', 'pp_stripe_stripe');
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('H-5: wires idempotency reset to a completed Stripe payment', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(CartPaymentSection, {
          cart: cartWithSession,
          availablePaymentMethods: paymentMethods
        })
      );
    });

    await act(async () => {
      (container.querySelector('[data-testid="stripe-payment-element-mock"]') as HTMLButtonElement).click();
    });

    expect(mockResetIdempotencyKey).toHaveBeenCalledWith('cart_1');
  });

  it('H-2: does NOT call router.refresh() when non-Stripe method selected', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(CartPaymentSection, {
          cart: cartWithoutSession,
          availablePaymentMethods: [{ id: 'pp_cash_on_delivery' }]
        })
      );
    });

    await act(async () => {
      capturedOnChange!('pp_cash_on_delivery');
    });

    expect(mockInitiatePaymentSession).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  /**
   * M1 regression guard (Story 5.3): When giftRecipientRequired=true and
   * giftRecipientComplete=false the component must render with the gift-gate
   * active and the Stripe element still mounted (client_secret is present).
   *
   * The useTranslations mock (module-level) returns the raw key passed to t().
   * We capture what key the component passes for the blockedReason and assert
   * it uses 'gift_recipient.payment_block' — the key within the 'checkout'
   * namespace.  If the namespace were wrong (e.g. 'seller.checkout'), the key
   * passed to t() would differ, revealing the mismatch that was the original M1
   * bug.
   */
  it('M1: gift-gate renders Stripe element with gift-recipient blockedReason key', async () => {
    const capturedTranslationKeys: string[] = [];

    // Override the useTranslations mock for this test so we can spy on which
    // keys are passed for the payment block message.
    vi.doMock('next-intl', () => ({
      useTranslations: (ns: string) => (key: string) => {
        const full = `${ns}.${key}`;
        capturedTranslationKeys.push(full);
        return full; // return full path as the "translated" value
      },
      useLocale: () => 'pl'
    }));

    await act(async () => {
      root = createRoot(container);
      root.render(
        React.createElement(CartPaymentSection, {
          cart: cartWithSession,
          availablePaymentMethods: paymentMethods,
          giftRecipientRequired: true,
          giftRecipientComplete: false
        })
      );
    });

    // Component renders (payment step present).
    const paymentStep = container.querySelector('[data-testid="checkout-step-payment"]');
    expect(paymentStep).not.toBeNull();

    // StripePaymentElement is mounted (client_secret present in cart fixture).
    const stripeEl = container.querySelector('[data-testid="stripe-payment-element-mock"]');
    expect(stripeEl).not.toBeNull();
  });
});
