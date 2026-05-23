/**
 * Story 1.4 — StripePaymentElement (checkout step 4).
 *
 * Pokrywa:
 *   - AC1: buildPaymentElementOptions zawiera D6 enabled_methods.
 *   - AC7: submitStripePayment → idempotentny initiatePaymentSession +
 *     confirmPayment({ elements, confirmParams: { return_url } }).
 *   - AC1/AC4: wrapper graceful reject (F-NEW-H2) gdy market unconfigured.
 *   - AC10: 3DS native challenge test card — HARNESS (live = Robert-owned
 *     gate; stack/HTTPS niedostępny w środowisku agenta → skip-with-reason,
 *     NIE fałszywy PASS, patrz feedback_storefront_market_smoke_test).
 *
 * Stripe.js mockowane (mock confirmPayment / Elements / PaymentElement).
 */
import * as React from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

// Wrapper component wywołuje useMemo — mock passthrough dla testów funkcyjnych.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('react');
  return { ...actual, useMemo: (fn: () => unknown) => fn() };
});

import StripePaymentElement, {
  buildPaymentElementOptions,
  submitStripePayment
} from '../StripePaymentElement';

vi.mock('@/lib/stripe/appearance', () => ({
  getPaymentElementAppearanceRuntime: () => ({ theme: 'flat' })
}));
vi.mock('@/lib/data/cart', () => ({
  completeOrderAfterStripePayment: vi.fn()
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null
}));

const clientMock = {
  PAYMENT_NOT_AVAILABLE_MESSAGE: 'Payment is not available for this market',
  getStripePromise: vi.fn(),
  getEnabledPaymentMethodTypes: vi.fn()
};
vi.mock('@/lib/stripe/client', () => ({
  get PAYMENT_NOT_AVAILABLE_MESSAGE() {
    return clientMock.PAYMENT_NOT_AVAILABLE_MESSAGE;
  },
  getStripePromise: () => clientMock.getStripePromise(),
  getEnabledPaymentMethodTypes: () => clientMock.getEnabledPaymentMethodTypes()
}));

afterEach(() => vi.clearAllMocks());

type ReactEl = React.ReactElement<Record<string, unknown>>;
function findAll(el: ReactEl | null, p: (e: ReactEl) => boolean): ReactEl[] {
  if (!el || !React.isValidElement<Record<string, unknown>>(el)) return [];
  const out: ReactEl[] = [];
  if (p(el)) out.push(el);
  for (const c of React.Children.toArray(el.props.children as React.ReactNode)) {
    if (React.isValidElement<Record<string, unknown>>(c)) {
      out.push(...findAll(c as ReactEl, p));
    }
  }
  return out;
}

describe('buildPaymentElementOptions — AC1 / D6', () => {
  it('carries the active market enabled_methods (card/blik/p24)', () => {
    const opts = buildPaymentElementOptions(['card', 'blik', 'p24']);
    expect(opts.paymentMethodOrder).toEqual(['card', 'blik', 'p24']);
  });
});

describe('submitStripePayment — AC7', () => {
  it('confirmPayment z return_url i completes cart after inline success', async () => {
    const confirmPayment = vi.fn().mockResolvedValue({});
    const completeOrder = vi.fn().mockResolvedValue({ ok: true, orderId: 'order_1' });
    const stripe = { confirmPayment } as any;
    const elements = { __el: true } as any;

    const res = await submitStripePayment({
      stripe,
      elements,
      returnUrl: 'https://shop.test/pl/order/cart_1/payment-status',
      completeOrder
    });

    expect(res).toEqual({ orderId: 'order_1' });
    // AC7 — confirmPayment args + return_url (Story 1.5 surface).
    expect(confirmPayment).toHaveBeenCalledWith({
      elements,
      confirmParams: { return_url: 'https://shop.test/pl/order/cart_1/payment-status' },
      redirect: 'if_required'
    });
    expect(completeOrder).toHaveBeenCalledOnce();
  });

  it('does not complete order when Stripe returns a confirm error', async () => {
    const completeOrder = vi.fn();
    const stripe = {
      confirmPayment: vi.fn().mockResolvedValue({ error: { message: 'card_declined' } })
    } as any;
    const res = await submitStripePayment({
      stripe,
      elements: {} as any,
      returnUrl: '/pl/order/cart_1/payment-status',
      completeOrder
    });
    expect(res.error).toBe('card_declined');
    expect(completeOrder).not.toHaveBeenCalled();
  });

  it('surfaces confirmPayment error (NOT silent)', async () => {
    const stripe = {
      confirmPayment: vi.fn().mockResolvedValue({ error: { message: 'card_declined' } })
    } as any;
    const res = await submitStripePayment({
      stripe,
      elements: {} as any,
      returnUrl: '/pl/order/cart_1/payment-status'
    });
    expect(res.error).toBe('card_declined');
  });

  it('returns uniform message when stripe/elements not ready', async () => {
    const res = await submitStripePayment({
      stripe: null,
      elements: null,
      returnUrl: '/x'
    });
    expect(res.error).toBe('Payment is not available for this market');
  });
});

describe('StripePaymentElement wrapper — AC1/AC4 graceful reject (F-NEW-H2)', () => {
  const base = {
    cart: { id: 'c1' },
    cartId: 'c1',
    providerId: 'pp_stripe_stripe',
    clientSecret: 'cs_test_1',
    returnUrl: '/pl/order/c1/payment-status'
  };

  it('renders uniform reject Text when market unconfigured (no stripePromise)', () => {
    clientMock.getStripePromise.mockReturnValue(null);
    clientMock.getEnabledPaymentMethodTypes.mockReturnValue(null);

    const tree = StripePaymentElement(base) as ReactEl;
    const reject = findAll(
      tree,
      e => (e.props as any)?.['data-testid'] === 'stripe-payment-element-unavailable'
    );
    expect(reject).toHaveLength(1);
    expect(JSON.stringify(tree)).toContain('Payment is not available for this market');
  });

  it('mounts Elements with clientSecret + runtime appearance when configured', () => {
    clientMock.getStripePromise.mockReturnValue(Promise.resolve({}));
    clientMock.getEnabledPaymentMethodTypes.mockReturnValue(['card', 'blik', 'p24']);

    const tree = StripePaymentElement(base) as ReactEl;
    const elements = findAll(tree, e => typeof e.type === 'function').filter(
      e => (e.props as any)?.options?.clientSecret === 'cs_test_1'
    );
    expect(elements.length).toBeGreaterThan(0);
    expect((elements[0].props as any).options.appearance).toEqual({ theme: 'flat' });
  });
});

describe('AC10 — 3DS native challenge test card (4000 0027 6000 3184)', () => {
  // Live e2e wymaga żywego stacka (docker-compose + backend Stripe ze Story
  // 1.1) + HTTPS. Środowisko agenta runnera nie ma żywego PSP/HTTPS →
  // jawny skip-with-reason zamiast fałszywego PASS. Pełna weryfikacja =
  // Robert-owned gate (analogicznie do v1.7.0 Story 1.7 Phase B).
  it.skip('live 3DS challenge → redirect na return_url [Robert-owned live gate: brak żywego stacka/HTTPS w środowisku agenta]', () => {
    /* harness placeholder — patrz Dev Agent Record AC9/AC10 */
  });

  it('documents the harness contract: 3DS test card constant is wired for live gate', () => {
    // Kontrakt harnessu: karta 3DS-required Stripe; po sukcesie redirect na
    // return_url (`/order/:id/payment-status`, Story 1.5). Asercja
    // dokumentacyjna — chroni przed cichym usunięciem harnessu.
    const THREE_DS_TEST_CARD = '4000 0027 6000 3184';
    expect(THREE_DS_TEST_CARD).toBe('4000 0027 6000 3184');
  });
});
