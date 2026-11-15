/**
 * v1.16.0 Story 8.3 AC1 (FR-15, AD-18) — każdy punkt przerwania z inwentarza
 * 8.1 (`evidence/8-1/3ds-return-path-inventory.v1.md`, gałęzie synch. 3–8)
 * daje stan ∉ {sukces, nigdy-nierozpoczęty}. Kontrole dodatnie: realny sukces
 * ⇒ `success`; powrót bez żadnego śladu płatności ⇒ `never_started`.
 *
 * Punkty synch. 1–2 (inicjacja, confirm) kończą się PRZED przekierowaniem —
 * nie ma powrotu na stronę statusu, więc nie mają stanu powrotu (macierz
 * `evidence/8-3/interruption-state-matrix.v1.md`).
 */
import { describe, expect, it } from 'vitest';

import { classifyPaymentReturnIdentifier } from '../payment-return-identifier';
import {
  decidePaymentReturnState,
  parsePaymentChargeFact,
  paymentChargeMessageKey,
  paymentReturnLifecycle,
  type PaymentReturnFacts,
  type PaymentReturnState,
  type StripeReturnParams
} from '../payment-return-state';

const CART = 'cart_01STORY83INTERRUPT';
const PI = 'pi_3STORY83';

function facts(over: Partial<PaymentReturnFacts> = {}): PaymentReturnFacts {
  return {
    identifier: classifyPaymentReturnIdentifier(CART),
    params: { payment_intent: PI, redirect_status: 'succeeded', ambiguous: false },
    ordersBeforeCompletion: [],
    bridgeReadState: 'empty',
    completionAttempted: false,
    ordersAfterCompletion: [],
    completionFailed: false,
    ...over
  };
}

const params = (p: Partial<StripeReturnParams>): StripeReturnParams => ({ ambiguous: false, ...p });

/** Punkt przerwania 8.1 → stan zapisany przez maszynę stanów / resolver. */
const INTERRUPTION_POINTS: Array<{ point: string; state: PaymentReturnState; params: StripeReturnParams }> = [
  {
    point: 'synch. 3 — challenge 3DS porzucony (redirect_status=failed)',
    state: decidePaymentReturnState(facts({ params: params({ payment_intent: PI, redirect_status: 'failed' }) })),
    params: params({ payment_intent: PI, redirect_status: 'failed' })
  },
  {
    point: 'synch. 3 — powrót z intencją bez potwierdzenia (redirect_status=processing)',
    state: decidePaymentReturnState(facts({ params: params({ payment_intent: PI, redirect_status: 'processing' }) })),
    params: params({ payment_intent: PI, redirect_status: 'processing' })
  },
  {
    point: 'synch. 4 — identyfikator spoza dziedziny',
    state: decidePaymentReturnState(facts({ identifier: classifyPaymentReturnIdentifier('xyz_1') })),
    params: params({ payment_intent: PI, redirect_status: 'succeeded' })
  },
  ...(
    [
      'not_a_cart',
      'no_stripe_confirmation',
      'cart_ownership_unproven',
      'payment_intent_mismatch',
      'ambiguous_return_parameters'
    ] as const
  ).map(reason => ({
    point: `synch. 5 — brama mutacji: ${reason}`,
    state: { state: 'return_refused', reason } as PaymentReturnState,
    params: params({ payment_intent: PI, redirect_status: 'succeeded' })
  })),
  ...(['read_failed', 'access_denied', 'incomplete', 'malformed'] as const).map(bridgeReadState => ({
    point: `synch. 6 — odczyt przed mutacją: ${bridgeReadState}`,
    state: decidePaymentReturnState(facts({ bridgeReadState })),
    params: params({ payment_intent: PI, redirect_status: 'succeeded' })
  })),
  {
    point: 'synch. 7 — completion: błąd workflow/transportu',
    state: decidePaymentReturnState(facts({ completionAttempted: true, completionFailed: true })),
    params: params({ payment_intent: PI, redirect_status: 'succeeded' })
  },
  {
    point: 'synch. 7 — completion bez zamówienia',
    state: decidePaymentReturnState(facts({ completionAttempted: true })),
    params: params({ payment_intent: PI, redirect_status: 'succeeded' })
  },
  ...(
    [
      ['psp_not_terminal', 'pending_confirmation'],
      ['completion_in_progress', 'pending_confirmation'],
      ['cart_unavailable', 'recovery_required'],
      ['outcome_marker_unavailable', 'recovery_required'],
      ['outcome_marker_capacity_exhausted', 'recovery_required']
    ] as const
  ).map(([reason, state]) => ({
    point: `synch. 7 — odmowa autorytetu / marker: ${reason}`,
    state: { state, reason } as PaymentReturnState,
    params: params({ payment_intent: PI, redirect_status: 'succeeded' })
  }))
];

describe('Story 8.3 AC1 — stan przerwania jest rozłączny z sukcesem i z nigdy-nierozpoczętym', () => {
  it.each(INTERRUPTION_POINTS.map(p => [p.point, p] as const))('%s ⇒ interrupted', (_point, p) => {
    expect(p.state.state).not.toBe('confirmed');
    const lifecycle = paymentReturnLifecycle(p.state, p.params);
    expect(lifecycle).toBe('interrupted');
    expect(['success', 'never_started']).not.toContain(lifecycle);
  });

  it('kontrola dodatnia: realny sukces (zamówienia po domknięciu) ⇒ success', () => {
    const state = decidePaymentReturnState(
      facts({ completionAttempted: true, ordersAfterCompletion: ['order_01A'] })
    );
    expect(state.state).toBe('confirmed');
    expect(paymentReturnLifecycle(state, params({ payment_intent: PI, redirect_status: 'succeeded' }))).toBe('success');
  });

  it('kontrola dodatnia: odświeżenie domkniętego koszyka ⇒ success', () => {
    const state = decidePaymentReturnState(facts({ ordersBeforeCompletion: ['order_01A'], bridgeReadState: 'complete' }));
    expect(paymentReturnLifecycle(state, params({}))).toBe('success');
  });

  it('kontrola dodatnia: wejście bez żadnego śladu płatności ⇒ never_started', () => {
    const state = decidePaymentReturnState(facts({ params: params({}) }));
    expect(state).toEqual({ state: 'pending_confirmation', reason: 'awaiting_psp' });
    expect(paymentReturnLifecycle(state, params({}))).toBe('never_started');
  });

  it('regresja zlania: intencja bez domknięcia ≠ nigdy-nierozpoczęte (return_interrupted ≠ awaiting_psp)', () => {
    const interrupted = decidePaymentReturnState(
      facts({ params: params({ payment_intent: PI, redirect_status: 'processing' }) })
    );
    const neverStarted = decidePaymentReturnState(facts({ params: params({}) }));
    expect(interrupted).toEqual({ state: 'pending_confirmation', reason: 'return_interrupted' });
    expect(interrupted).not.toEqual(neverStarted);
  });

  it('przerwany nigdy nie renderuje się jak sukces: żaden punkt nie daje stanu confirmed', () => {
    expect(INTERRUPTION_POINTS.filter(p => p.state.state === 'confirmed')).toEqual([]);
    expect(INTERRUPTION_POINTS.length).toBe(19);
  });
});

describe('Story 8.3 AC1 — fakt o pobraniu (kształt odpowiedzi backendu)', () => {
  it.each([
    [{ charge: 'charged' }, 'charged'],
    [{ charge: 'not_charged' }, 'not_charged'],
    [{ charge: 'unknown' }, 'unknown'],
    [{ charge: 'maybe' }, 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown']
  ])('%j ⇒ %s (nigdy domyślnie not_charged)', (raw, expected) => {
    expect(parsePaymentChargeFact(raw)).toBe(expected);
  });

  it('klucz i18n komunikatu', () => {
    expect(paymentChargeMessageKey('charged')).toBe('return_charge.charged');
  });
});
