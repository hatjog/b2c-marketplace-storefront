/**
 * v1.15.0 Story 3.6 (AC3/AC4, NFR-2, AD-19) — rozstrzyganie identyfikatora
 * i ROZRÓŻNIALNOŚĆ stanów powrotu z 3DS, mierzone wykonaniem.
 *
 * Kluczowa asercja tej suity nie brzmi „strona się wyrenderowała", tylko:
 * PORZUCENIE i ODŚWIEŻENIE dają RÓŻNE stany. Test poniżej PĘKA, jeśli oba
 * zaczną zwracać to samo — to jest jego jedyny powód istnienia.
 */

import { describe, expect, it } from 'vitest';

import { classifyPaymentReturnIdentifier } from '../payment-return-identifier';
import { decidePaymentReturnState, type PaymentReturnFacts } from '../payment-return-state';

const CART = 'cart_01STORY36CART';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';

function facts(overrides: Partial<PaymentReturnFacts> = {}): PaymentReturnFacts {
  return {
    identifier: classifyPaymentReturnIdentifier(CART),
    params: {},
    ordersBeforeCompletion: [],
    completionAttempted: false,
    ordersAfterCompletion: [],
    completionFailed: false,
    ...overrides
  };
}

describe('AC3 — rodzaj identyfikatora rozstrzygany po własności wartości', () => {
  it('koszyk, zamówienie i grupa są rozpoznawane', () => {
    expect(classifyPaymentReturnIdentifier(CART)).toEqual({ kind: 'cart', value: CART });
    expect(classifyPaymentReturnIdentifier(ORDER_A)).toEqual({ kind: 'order', value: ORDER_A });
    expect(classifyPaymentReturnIdentifier('ordgrp_01X').kind).toBe('order_group');
    expect(classifyPaymentReturnIdentifier('order_group_01X').kind).toBe('order_group');
  });

  it('grupa NIE jest klasyfikowana jako zamówienie mimo wspólnego prefiksu', () => {
    expect(classifyPaymentReturnIdentifier('order_group_01X').kind).not.toBe('order');
    expect(classifyPaymentReturnIdentifier('order_set_01X').kind).not.toBe('order');
  });

  it('wartość spoza dziedziny → NAZWANY kod błędu, nigdy wartość domyślna (AD-19)', () => {
    for (const raw of ['', '   ', 'cart_', 'zupelnie_cos_innego', 42, null, undefined, {}]) {
      expect(classifyPaymentReturnIdentifier(raw)).toMatchObject({
        kind: null,
        errorCode: 'identifier_out_of_domain'
      });
    }
  });

  it('identyfikator spoza dziedziny kończy się nazwanym stanem, nie ciszą', () => {
    const result = decidePaymentReturnState(
      facts({ identifier: classifyPaymentReturnIdentifier('nonsens') })
    );
    expect(result).toEqual({ state: 'identifier_out_of_domain' });
  });

  it('identyfikator ZAMÓWIENIA prowadzi wprost na potwierdzenie (ponowne wejście)', () => {
    const result = decidePaymentReturnState(
      facts({ identifier: classifyPaymentReturnIdentifier(ORDER_A) })
    );
    expect(result).toEqual({ state: 'confirmed', orderIds: [ORDER_A], reentry: true });
  });
});

describe('AC2 — serwerowe domknięcie i idempotencja', () => {
  it('pierwsze wejście po 3DS: domknięcie serwerowe → potwierdzenie z DWOMA zamówieniami', () => {
    const result = decidePaymentReturnState(
      facts({
        params: { redirect_status: 'succeeded', payment_intent: 'pi_123' },
        completionAttempted: true,
        ordersAfterCompletion: [ORDER_A, ORDER_B]
      })
    );

    expect(result).toEqual({
      state: 'confirmed',
      orderIds: [ORDER_A, ORDER_B],
      reentry: false
    });
  });

  it('koszyk już domknięty → potwierdzenie jako ODCZYT, bez ponownego domykania', () => {
    const result = decidePaymentReturnState(
      facts({
        ordersBeforeCompletion: [ORDER_A, ORDER_B],
        completionAttempted: false
      })
    );

    expect(result).toEqual({
      state: 'confirmed',
      orderIds: [ORDER_A, ORDER_B],
      reentry: true
    });
  });

  it('N=1 nie regresuje: jedno zamówienie kończy się potwierdzeniem', () => {
    const result = decidePaymentReturnState(
      facts({ completionAttempted: true, ordersAfterCompletion: [ORDER_A] })
    );
    expect(result).toEqual({ state: 'confirmed', orderIds: [ORDER_A], reentry: false });
  });
});

describe('AC4 — porzucenie i odświeżenie są ROZRÓŻNIALNE (NFR-2)', () => {
  const abandoned = decidePaymentReturnState(
    facts({ params: { redirect_status: 'failed', payment_intent: 'pi_123' } })
  );
  const refreshedAfterSuccess = decidePaymentReturnState(
    facts({
      params: { redirect_status: 'succeeded', payment_intent: 'pi_123' },
      ordersBeforeCompletion: [ORDER_A, ORDER_B]
    })
  );

  it('porzucenie uwierzytelnienia ma własny, nazwany stan', () => {
    expect(abandoned).toEqual({
      state: 'authentication_abandoned',
      reason: 'redirect_status_failed'
    });
  });

  it('odświeżenie po sukcesie kończy się potwierdzeniem i NIE cofa stanu', () => {
    expect(refreshedAfterSuccess).toMatchObject({ state: 'confirmed', reentry: true });
  });

  /**
   * TO JEST ta asercja. Gdyby oba wejścia zaczęły zwracać ten sam stan —
   * a dokładnie tak było przed tą story, bo strona przy każdym renderze robiła
   * to samo — ten test pęka.
   */
  it('oba wejścia NIE mogą dać tego samego stanu', () => {
    expect(abandoned.state).not.toBe(refreshedAfterSuccess.state);
  });

  it('domknięcie bez zamówienia → porzucenie, nie wieczne „czekamy"', () => {
    const result = decidePaymentReturnState(
      facts({ completionAttempted: true, ordersAfterCompletion: [] })
    );
    expect(result).toEqual({
      state: 'authentication_abandoned',
      reason: 'completion_produced_no_order'
    });
  });

  it('porażka samego domknięcia → stan oczekiwania z odrębnym powodem', () => {
    const result = decidePaymentReturnState(
      facts({ completionAttempted: true, completionFailed: true })
    );
    expect(result).toEqual({ state: 'pending_confirmation', reason: 'completion_failed' });
  });

  it('żaden stan nie jest optymistycznym „opłacone" bez zamówień', () => {
    const states = [
      decidePaymentReturnState(facts()),
      decidePaymentReturnState(facts({ params: { redirect_status: 'failed' } })),
      decidePaymentReturnState(facts({ completionAttempted: true }))
    ];

    for (const state of states) {
      expect(state.state).not.toBe('confirmed');
    }
  });
});
