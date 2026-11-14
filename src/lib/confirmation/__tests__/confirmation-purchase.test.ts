/**
 * v1.15.0 Story 3.7 (AC1, AC2) — NOŚNIK KOLEKCJI i liczność kontraktu.
 *
 * Test pęka po cofnięciu nośnika: gdy segment trasy potwierdzenia znów będzie
 * niósł jedno zamówienie, `collection` przestanie być osiągalne dla koszyka,
 * a `order_count` przestanie docierać do powierzchni.
 */

import { describe, expect, it } from 'vitest';

import { classifyPaymentReturnIdentifier } from '@/lib/checkout/payment-return-identifier';
import { resolveBridgePurchase } from '@/lib/checkout/completed-order-ids';

import { decideConfirmationPurchase } from '../confirmation-purchase';
import { resolveConfirmationCardinality } from '../order-confirmed-stepper';

describe('resolveBridgePurchase — liczność kontraktu dociera do powierzchni', () => {
  it('czyta kolekcję RAZEM z order_count', () => {
    expect(
      resolveBridgePurchase({
        orders: [{ order_id: 'order_a' }, { order_id: 'order_b' }],
        order_count: 2,
        order_id: 'order_b'
      })
    ).toEqual({ orderIds: ['order_a', 'order_b'], expectedOrderCount: 2, state: 'complete' });
  });

  it('backend sprzed v1.15.0 (sam skalar) daje kolekcję 1-elementową i BRAK liczności', () => {
    expect(resolveBridgePurchase({ order_id: 'order_legacy' })).toEqual({
      orderIds: ['order_legacy'],
      expectedOrderCount: null,
      state: 'complete'
    });
  });

  it('order_count spoza dziedziny nie udaje liczności', () => {
    expect(
      resolveBridgePurchase({ orders: [{ order_id: 'a' }], order_count: 0 }).expectedOrderCount
    ).toBeNull();
    expect(
      resolveBridgePurchase({ orders: [{ order_id: 'a' }], order_count: '2' }).expectedOrderCount
    ).toBeNull();
  });
});

describe('decideConfirmationPurchase — segment trasy niesie ZAKUP', () => {
  it('koszyk rozwija się w CAŁĄ kolekcję z licznością', () => {
    const decision = decideConfirmationPurchase({
      identifier: classifyPaymentReturnIdentifier('cart_123'),
      bridge: { orderIds: ['order_a', 'order_b'], expectedOrderCount: 2 }
    });

    expect(decision).toEqual({
      kind: 'collection',
      orderIds: ['order_a', 'order_b'],
      expectedOrderCount: 2
    });
  });

  it('identyfikator zamówienia (link z maila) jest DRILL-DOWNEM, nie całością', () => {
    const decision = decideConfirmationPurchase({
      identifier: classifyPaymentReturnIdentifier('order_from_email'),
      bridge: null
    });

    expect(decision.kind).toBe('drilldown');
  });

  it('koszyk bez zamówień to NAZWANY stan, nie pusta lista', () => {
    expect(
      decideConfirmationPurchase({
        identifier: classifyPaymentReturnIdentifier('cart_123'),
        bridge: { orderIds: [], expectedOrderCount: null }
      }).kind
    ).toBe('purchase_not_found');

    expect(
      decideConfirmationPurchase({
        identifier: classifyPaymentReturnIdentifier('cart_123'),
        bridge: { orderIds: [], expectedOrderCount: null, readFailed: false }
      }).kind
    ).toBe('purchase_not_found');
  });

  // ── review-fix HIGH-3 (AC3, AD-19) ────────────────────────────────────────
  //
  // Kontrola PĘKAJĄCA po cofnięciu poprawki: przed nią oba wejścia poniżej
  // dawały `purchase_not_found`, więc kupująca po obciążeniu karty czytała
  // „link jest nieaktualny" także wtedy, gdy backend leżał.
  it('PORAŻKA ODCZYTU jest odróżnialna od „zakup nie ma zamówień"', () => {
    const readFailed = decideConfirmationPurchase({
      identifier: classifyPaymentReturnIdentifier('cart_123'),
      bridge: { orderIds: [], expectedOrderCount: null, readFailed: true }
    });
    const empty = decideConfirmationPurchase({
      identifier: classifyPaymentReturnIdentifier('cart_123'),
      bridge: { orderIds: [], expectedOrderCount: null, readFailed: false }
    });

    expect(readFailed.kind).toBe('read_failed');
    expect(empty.kind).toBe('purchase_not_found');
    expect(readFailed.kind).not.toBe(empty.kind);
  });

  it('brak odpowiedzi mostka (wyjątek transportu) to `read_failed`, nie brak zakupu', () => {
    expect(
      decideConfirmationPurchase({
        identifier: classifyPaymentReturnIdentifier('cart_123'),
        bridge: null
      }).kind
    ).toBe('read_failed');
  });

  it.each([
    ['access_denied', 'access_denied'],
    ['incomplete', 'incomplete_order_set'],
    ['malformed', 'malformed_purchase']
  ] as const)('stan mostka %s nie jest prezentowany jako pełna kolekcja', (state, kind) => {
    expect(
      decideConfirmationPurchase({
        identifier: classifyPaymentReturnIdentifier('cart_123'),
        bridge: { orderIds: ['order_a'], expectedOrderCount: 2, state }
      }).kind
    ).toBe(kind);
  });

  it('wartość spoza dziedziny jest BŁĘDEM, nie domyślną (AD-19)', () => {
    expect(
      decideConfirmationPurchase({
        identifier: classifyPaymentReturnIdentifier('zzz_999'),
        bridge: null
      }).kind
    ).toBe('out_of_domain');
  });
});

describe('resolveConfirmationCardinality — trzy wejścia, trzy odróżnialne wyniki', () => {
  it('pełny sukces, sukces częściowy i nadmiar są ROZRÓŻNIALNE', () => {
    const kinds = [
      resolveConfirmationCardinality(2, 2).kind,
      resolveConfirmationCardinality(1, 2).kind,
      resolveConfirmationCardinality(3, 2).kind
    ];

    expect(kinds).toEqual(['complete', 'partial', 'over_reported']);
    expect(new Set(kinds).size).toBe(3);
  });

  it('brak liczności w kontrakcie jest osobnym stanem, nie zgodnością', () => {
    expect(resolveConfirmationCardinality(1, null).kind).toBe('unknown_expected');
    expect(resolveConfirmationCardinality(1, undefined).kind).toBe('unknown_expected');
  });
});

/**
 * v1.16.0 Story 8.5 (AC1) — rozwinięcie identyfikatora zakupu w PEŁNĄ kolekcję
 * `order_id` z mostka `GET /store/carts/:id/completed-order`, wg kontraktu 8.1
 * (`specs/contracts/checkout/order-set-cardinality.v1.md`, przykład N=2).
 * Skalar `order_id` mostka jest wyłącznie drill-downem — nie wyznacza zakupu.
 */
describe('Story 8.5 — identyfikator zakupu ⇒ pełny order-set z mostka', () => {
  const contractBridge = {
    orders: [
      { order_id: 'order_f2_seller_a', order_group_id: 'ordgrp_checkout_01' },
      { order_id: 'order_f2_seller_b', order_group_id: 'ordgrp_checkout_01' }
    ],
    order_count: 2,
    order_id: 'order_f2_seller_b',
    order_group_id: 'ordgrp_checkout_01'
  };

  function decide(body: unknown) {
    return decideConfirmationPurchase({
      identifier: classifyPaymentReturnIdentifier('cart_8_5_multi_seller'),
      bridge: resolveBridgePurchase(body)
    });
  }

  it('przykład normatywny N=2: kolekcja obu zamówień, nie skalar drill-down', () => {
    const decision = decide(contractBridge);
    expect(decision.kind).toBe('collection');
    if (decision.kind !== 'collection') return;
    expect(new Set(decision.orderIds)).toEqual(new Set(['order_f2_seller_a', 'order_f2_seller_b']));
    expect(decision.orderIds).toHaveLength(2);
    expect(decision.expectedOrderCount).toBe(2);
  });

  it('zmiana kolejności `orders` nie zmienia zbioru order_id', () => {
    const reversed = { ...contractBridge, orders: [...contractBridge.orders].reverse() };
    const a = decide(contractBridge);
    const b = decide(reversed);
    if (a.kind !== 'collection' || b.kind !== 'collection') throw new Error('oczekiwano kolekcji');
    expect(new Set(b.orderIds)).toEqual(new Set(a.orderIds));
  });

  it('N=3: wszystkie trzy order_id docierają do powierzchni', () => {
    const decision = decide({
      orders: [{ order_id: 'o_1' }, { order_id: 'o_2' }, { order_id: 'o_3' }],
      order_count: 3,
      order_id: 'o_3'
    });
    expect(decision).toEqual({
      kind: 'collection',
      orderIds: ['o_1', 'o_2', 'o_3'],
      expectedOrderCount: 3
    });
  });

  it('`orders` krótsze niż `order_count` NIE jest sukcesem z pierwszym zamówieniem', () => {
    const decision = decide({ orders: [{ order_id: 'o_1' }], order_count: 2, order_id: 'o_1' });
    expect(decision.kind).toBe('incomplete_order_set');
  });
});
