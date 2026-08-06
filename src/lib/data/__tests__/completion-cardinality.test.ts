/**
 * v1.15.0 Story 3.6 review-fix (MEDIUM) — kardynalność NIE zależy od
 * niezmierzonego zachowania ogniwa 1.
 *
 * ── Czego brakowało ────────────────────────────────────────────────────────
 * AC1 żąda liczności zmierzonej OSOBNO na każdym z trzech ogniw, a dla ogniwa 1
 * (workflow Mercura) — „z realnego przebiegu, surowy JSON w evidence". Dostarczono
 * odczyt DEKLARACJI TYPÓW z `node_modules` (`OrderGroupDTO`,
 * `StoreCompleteCartResponse`). Typ nie jest przebiegiem: nie wyklucza pola
 * dokładanego runtime'owo poza kontraktem typów i nie daje pomiaru liczności.
 * Ta luka wymaga żywego stacka Medusy + Stripe'a i pozostaje otwarta jako
 * pozycja dla PO/SM (patrz `## Fixes Applied` w pliku review).
 *
 * ── Co da się naprawić bez żywego stacka ───────────────────────────────────
 * Można usunąć ZALEŻNOŚĆ od tego pomiaru. Kod miał wcześniej skrót
 * `if (fromWorkflow.length > 1) return fromWorkflow` — czyli ZAŁOŻENIE, że skoro
 * workflow potrafi oddać N>1, to oddaje wszystkie. Bez pomiaru ogniwa 1 to
 * założenie nie ma pokrycia. Teraz mostek (który czyta `order_cart` w bazie i ma
 * pomiar wykonaniem na realnym PG) jest pytany ZAWSZE, gdy znamy koszyk, a wynik
 * to większa z dwóch kolekcji.
 *
 * Ta suita PĘKA po przywróceniu skrótu.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Map()
}));

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const fetchQuery = vi.fn();
vi.mock('@/lib/config', () => ({
  fetchQuery: (...args: unknown[]) => fetchQuery(...args),
  sdk: { store: { cart: { update: vi.fn() } } }
}));

const { resolveCompletedOrderIdsFromCompletion, getCompletedOrderIdsForCart } = await import(
  '../cart'
);
const { resolveCompletedOrderIds } = await import('@/lib/checkout/completed-order-ids');

const CART = 'cart_01STORY36CARDINALITY';
const A = 'order_01STORY36A';
const B = 'order_01STORY36B';
const C = 'order_01STORY36C';

function bridgeReturns(ids: string[]) {
  fetchQuery.mockImplementation(async (path: string) => {
    if (!path.includes('/completed-order')) {
      return { ok: false, status: 404 };
    }
    return ids.length > 0
      ? {
          ok: true,
          data: {
            orders: ids.map(id => ({ order_id: id, order_group_id: null })),
            order_count: ids.length
          }
        }
      : { ok: false, status: 404 };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  bridgeReturns([]);
});

describe('mostek jest AUTORYTETEM kardynalności', () => {
  it('workflow oddał 2, mostek zna 3 → wynik ma 3 (skrót `length > 1` gubił trzecie)', async () => {
    bridgeReturns([A, B, C]);

    // Kształt jest ZMIERZONY na rezolwerze ogniwa 1: `resolveCompletedOrderIds`
    // czyta `data.order_set.orders` (`completed-order-ids.ts:47`). Fixture,
    // którego rezolwer nie rozpoznaje, dałby tu 0 zamówień i test przechodziłby
    // także na zepsutym kodzie — sprawdzamy więc najpierw samo ogniwo 1.
    const completion = { data: { order_set: { orders: [{ id: A }, { id: B }] } } };
    expect(resolveCompletedOrderIds(completion)).toEqual([A, B]);

    const ids = await resolveCompletedOrderIdsFromCompletion(completion, CART);

    expect(new Set(ids)).toEqual(new Set([A, B, C]));
    // Mostek MUSIAŁ zostać odpytany — to jest sedno poprawki.
    expect(
      fetchQuery.mock.calls.filter(([p]) => String(p).includes('/completed-order')).length
    ).toBeGreaterThan(0);
  });

  it('workflow oddał 1, mostek zna 2 → wynik ma 2 (zakup u dwóch sprzedawców)', async () => {
    bridgeReturns([A, B]);

    const ids = await resolveCompletedOrderIdsFromCompletion({ data: { order: { id: A } } }, CART);

    expect(new Set(ids)).toEqual(new Set([A, B]));
  });

  it('mostek milczy → zostaje to, co dał workflow (brak regresji ścieżki jednosprzedawcowej)', async () => {
    bridgeReturns([]);

    const ids = await resolveCompletedOrderIdsFromCompletion({ data: { order: { id: A } } }, CART);

    expect(ids).toEqual([A]);
  });

  it('bez identyfikatora koszyka mostek nie jest pytany', async () => {
    await resolveCompletedOrderIdsFromCompletion({ data: { order: { id: A } } }, undefined);

    expect(fetchQuery).not.toHaveBeenCalled();
  });
});

describe('odczyt mostka dla powrotu 3DS ma konfigurowalne retry', () => {
  it('domyślnie JEDNO podejście', async () => {
    bridgeReturns([]);

    expect(await getCompletedOrderIdsForCart(CART)).toEqual([]);
    expect(fetchQuery).toHaveBeenCalledTimes(1);
  });

  it('`attempts: 2` ponawia, gdy join jeszcze nie dogonił', async () => {
    let call = 0;
    fetchQuery.mockImplementation(async () => {
      call += 1;
      return call === 1
        ? { ok: false, status: 404 }
        : { ok: true, data: { orders: [{ order_id: A, order_group_id: null }], order_count: 1 } };
    });

    expect(await getCompletedOrderIdsForCart(CART, { attempts: 2 })).toEqual([A]);
    expect(fetchQuery).toHaveBeenCalledTimes(2);
  });
});
