/**
 * v1.15.0 Story 3.6 (AC1, AD-16) — kardynalność mierzona OSOBNO na ogniwie 1
 * (odpowiedź workflow) i ogniwie 3 (rezolucja w storefroncie).
 *
 * Mierzenie tylko końca łańcucha przepuściłoby regresję środka: naprawa jednego
 * ogniwa maskuje zepsucie drugiego. Ogniwo 2 (SQL endpointu mostkowego) jest
 * mierzone osobno, na REALNYM Postgresie, w
 * `GP/backend/packages/api/src/__tests__/integration/completed-order-cardinality-pg.integration.test.ts`.
 *
 * KONTROLA NEGATYWNA: te testy PĘKAJĄ po przywróceniu indeksu `[0]` w
 * `resolveCompletedOrderIds` / `resolveBridgeOrderIds`. Przebiegi czerwony
 * i zielony są zapisane w `evidence/3-6/`.
 */

import { describe, expect, it } from 'vitest';

import {
  collectOrderIds,
  resolveBridgeOrderIds,
  resolveBridgePurchase,
  sameIdSet,
  resolveCompletedOrderIds
} from '../completed-order-ids';

const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';

describe('ogniwo 1 — kardynalność z odpowiedzi workflow domknięcia koszyka', () => {
  it('order_set z DWOMA zamówieniami → DWA identyfikatory (nie pierwszy)', () => {
    const res = {
      data: { order_set: { orders: [{ id: ORDER_A }, { id: ORDER_B }] } }
    };

    expect(resolveCompletedOrderIds(res)).toEqual([ORDER_A, ORDER_B]);
  });

  it('order_group z DWOMA zamówieniami → DWA identyfikatory', () => {
    const res = {
      data: { order_group: { orders: [{ id: ORDER_A }, { id: ORDER_B }] } }
    };

    expect(resolveCompletedOrderIds(res)).toEqual([ORDER_A, ORDER_B]);
  });

  it('order_set.order_group z DWOMA zamówieniami → DWA identyfikatory', () => {
    const res = {
      data: { order_set: { order_group: { orders: [{ id: ORDER_A }, { id: ORDER_B }] } } }
    };

    expect(resolveCompletedOrderIds(res)).toEqual([ORDER_A, ORDER_B]);
  });

  it('N=1: pojedyncze `order` (Medusa) → kolekcja jednoelementowa, nie null', () => {
    expect(resolveCompletedOrderIds({ data: { order: { id: ORDER_A } } })).toEqual([ORDER_A]);
    expect(resolveCompletedOrderIds({ order: { id: ORDER_A } })).toEqual([ORDER_A]);
  });

  it('kolekcja ma pierwszeństwo przed pojedynczym `order` — bez duplikatu', () => {
    const res = {
      data: {
        order_set: { orders: [{ id: ORDER_A }, { id: ORDER_B }] },
        order: { id: ORDER_A }
      }
    };

    expect(resolveCompletedOrderIds(res)).toEqual([ORDER_A, ORDER_B]);
  });

  it('ten sam identyfikator w dwóch kształtach nie jest liczony dwa razy', () => {
    const res = {
      data: { order_set: { orders: [{ id: ORDER_A }] } },
      order_group: { orders: [{ id: ORDER_A }] }
    };

    expect(resolveCompletedOrderIds(res)).toEqual([ORDER_A]);
  });

  it('brak zamówień → PUSTA kolekcja (nie `[undefined]`)', () => {
    expect(resolveCompletedOrderIds({ data: { order_group: {} } })).toEqual([]);
    expect(resolveCompletedOrderIds(null)).toEqual([]);
    expect(resolveCompletedOrderIds(undefined)).toEqual([]);
  });

  it('śmieci w kolekcji są odrzucane, a reszta zachowana', () => {
    const res = {
      data: {
        order_set: { orders: [{ id: ORDER_A }, null, { id: 42 }, { id: '' }, { id: ORDER_B }] }
      }
    };

    expect(resolveCompletedOrderIds(res)).toEqual([ORDER_A, ORDER_B]);
  });
});

describe('collectOrderIds — prymityw', () => {
  it('nie-tablica → pusta kolekcja', () => {
    expect(collectOrderIds(undefined)).toEqual([]);
    expect(collectOrderIds({ id: ORDER_A })).toEqual([]);
  });
});

describe('ogniwo 2→3 — odczyt kolekcji z endpointu mostkowego', () => {
  it('`orders` z DWOMA wierszami → DWA identyfikatory', () => {
    const data = {
      orders: [
        { order_id: ORDER_A, order_group_id: 'ordgrp_1' },
        { order_id: ORDER_B, order_group_id: 'ordgrp_1' }
      ],
      order_count: 2,
      order_id: ORDER_A
    };

    expect(resolveBridgeOrderIds(data)).toEqual([ORDER_A, ORDER_B]);
  });

  it('backend sprzed v1.15.0 (sam skalar) → kolekcja jednoelementowa', () => {
    expect(resolveBridgeOrderIds({ order_id: ORDER_A, order_group_id: null })).toEqual([ORDER_A]);
  });

  it('skalar legacy jest fallbackiem wyłącznie, gdy nie ma pola `orders`', () => {
    expect(resolveBridgeOrderIds({ order_id: ORDER_A })).toEqual([ORDER_A]);
    expect(resolveBridgeOrderIds({ orders: [], order_id: ORDER_A, order_count: 2 })).toEqual([]);
  });

  it('N=2 z jedną pozycją jest nazwanym niepełnym odczytem, nie sukcesem N=1', () => {
    expect(
      resolveBridgePurchase({
        orders: [{ order_id: ORDER_A, order_group_id: null }],
        order_count: 2,
        order_id: ORDER_A
      })
    ).toEqual({ orderIds: [ORDER_A], expectedOrderCount: 2, state: 'incomplete' });
  });

  it('nie przyjmuje śmieciowego wiersza jako kompletnego zbioru', () => {
    expect(
      resolveBridgePurchase({
        orders: [{ order_id: ORDER_A, order_group_id: null }, null],
        order_count: 1
      })
    ).toEqual({ orderIds: [], expectedOrderCount: 1, state: 'incomplete' });
  });

  it('nie przyjmuje duplikatu jako dwóch elementów kontraktu', () => {
    expect(
      resolveBridgePurchase({
        orders: [{ order_id: ORDER_A }, { order_id: ORDER_A }],
        order_count: 2
      })
    ).toEqual({ orderIds: [ORDER_A], expectedOrderCount: 2, state: 'incomplete' });
  });

  it('odróżnia niekształtną odpowiedź 200 od prawidłowej pustki 404', () => {
    expect(resolveBridgePurchase({})).toEqual({
      orderIds: [],
      expectedOrderCount: null,
      state: 'malformed'
    });
  });

  it('nic użytecznego → pusta kolekcja', () => {
    expect(resolveBridgeOrderIds({})).toEqual([]);
    expect(resolveBridgeOrderIds(null)).toEqual([]);
    expect(resolveBridgeOrderIds({ orders: [{ order_id: 7 }] })).toEqual([]);
  });
});

/**
 * v1.16.0 Story 8.6 (FR-17, AD-16, AC1, AC2) — stan terminalny dla WSZYSTKICH
 * zamówień order-setu; porównanie ZBIORÓW identyfikatorów, nie liczników.
 * Mutant „porównanie licznikiem” (orderIds.length === expected.length) czerwieni
 * przypadek „zgodna liczba, różny zbiór”.
 */
describe('Story 8.6 — resolveBridgePurchase po zbiorze identyfikatorów', () => {
  const terminal = (order_id: string) => ({ order_id, order_group_id: 'og_1', terminal: true });

  it('wszystkie terminalne i zbiór oczekiwany == otrzymany ⇒ complete, bez otwartych', () => {
    const purchase = resolveBridgePurchase({
      orders: [terminal('o_a'), terminal('o_b')],
      order_count: 2,
      expected_order_ids: ['o_b', 'o_a']
    });
    expect(purchase.state).toBe('complete');
    expect(purchase.openOrderIds).toEqual([]);
    expect(new Set(purchase.orderIds)).toEqual(new Set(['o_a', 'o_b']));
  });

  it('zgodna LICZBA, różny ZBIÓR ⇒ incomplete, brakujące zamówienie nazwane', () => {
    const purchase = resolveBridgePurchase({
      orders: [terminal('o_a'), terminal('o_b')],
      order_count: 2,
      expected_order_ids: ['o_a', 'o_c']
    });
    expect(purchase.state).toBe('incomplete');
    expect(purchase.openOrderIds).toEqual(['o_c']);
  });

  it('jedno zamówienie nieterminalne ⇒ incomplete i wskazane otwarte zamówienie (AC1)', () => {
    const purchase = resolveBridgePurchase({
      orders: [terminal('o_a'), { order_id: 'o_b', order_group_id: 'og_1', terminal: false }],
      order_count: 2,
      expected_order_ids: ['o_a', 'o_b']
    });
    expect(purchase.state).toBe('incomplete');
    expect(purchase.openOrderIds).toEqual(['o_b']);
  });

  it('brak pola `terminal` przy zbiorze oczekiwanym = brak dowodu ⇒ otwarte, nie ciche complete', () => {
    const purchase = resolveBridgePurchase({
      orders: [{ order_id: 'o_a' }],
      order_count: 1,
      expected_order_ids: ['o_a']
    });
    expect(purchase.state).toBe('incomplete');
    expect(purchase.openOrderIds).toEqual(['o_a']);
  });

  it('`expected_order_ids` w złym kształcie ⇒ malformed', () => {
    expect(
      resolveBridgePurchase({ orders: [terminal('o_a')], order_count: 1, expected_order_ids: 'o_a' })
        .state
    ).toBe('malformed');
  });

  it('sameIdSet: równość zbiorów, nie liczności', () => {
    expect(sameIdSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIdSet(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameIdSet(['a'], ['a', 'b'])).toBe(false);
  });
});
