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
      data: { order_set: { orders: [{ id: ORDER_A }, null, { id: 42 }, { id: '' }, { id: ORDER_B }] } }
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

  it('pusta kolekcja + skalar → skalar (kompatybilność wstecz nie gubi wyniku)', () => {
    expect(resolveBridgeOrderIds({ orders: [], order_id: ORDER_A })).toEqual([ORDER_A]);
  });

  it('nic użytecznego → pusta kolekcja', () => {
    expect(resolveBridgeOrderIds({})).toEqual([]);
    expect(resolveBridgeOrderIds(null)).toEqual([]);
    expect(resolveBridgeOrderIds({ orders: [{ order_id: 7 }] })).toEqual([]);
  });
});
