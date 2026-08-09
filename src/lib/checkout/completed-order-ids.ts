/**
 * v1.15.0 Story 3.6 (FR-7, AD-16) — czysta warstwa OGNIWA 3 kontraktu powrotu 3DS.
 *
 * Do v1.15.0 rezolucja mieszkała w `lib/data/cart.ts` jako
 * `resolveCompletedOrderId(res: any): string | null` i czytała indeks `[0]`
 * z trzech różnych kształtów odpowiedzi. Zakup u dwóch sprzedawców produkuje
 * JEDNO zamówienie NA SPRZEDAWCĘ, więc `[0]` cicho gubił drugie: kupująca
 * wracała z 3DS na potwierdzenie jednej z dwóch kupionych rzeczy.
 *
 * AD-16 zakazuje redukcji zbioru do jednego elementu przez indeks, `.first()`
 * ani sortowanie. Ten moduł jest CZYSTY (bez `'use server'`, bez sieci), żeby
 * kardynalność dało się zmierzyć wykonaniem, a nie tylko przeczytać w kodzie.
 */

/** Kształt wiersza kolekcji z endpointu mostkowego `GET /store/carts/:id/completed-order`. */
export type BridgeOrderEntry = {
  order_id?: unknown;
  order_group_id?: unknown;
};

/** Wyciąga identyfikatory z tablicy obiektów `{ id }`, odrzucając śmieci. */
export function collectOrderIds(orders: unknown): string[] {
  if (!Array.isArray(orders)) {
    return [];
  }
  return orders
    .map(entry => (entry as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Kardynalność z odpowiedzi workflow domknięcia koszyka (ogniwo 1).
 *
 * Kształty są trzy, bo trzy warianty realnie krążą w tym repo:
 * `order_group.orders` (Mercur), `order_set.orders` (Mercur multi-seller) oraz
 * pojedyncze `order` (Medusa `StoreCompleteCartResponse` — koszyk
 * jednosprzedawcowy). Wariant pojedynczy jest czytany DOPIERO wtedy, gdy żadna
 * kolekcja nie przyszła — inaczej koszyk dwusprzedawcowy zwracałby trzeci,
 * zduplikowany identyfikator.
 */
export function resolveCompletedOrderIds(res: unknown): string[] {
  const shape = res as any;

  const fromCollections = [
    ...collectOrderIds(shape?.data?.order_group?.orders),
    ...collectOrderIds(shape?.order_group?.orders),
    ...collectOrderIds(shape?.data?.order_set?.orders),
    ...collectOrderIds(shape?.data?.order_set?.order_group?.orders)
  ];

  if (fromCollections.length > 0) {
    return Array.from(new Set(fromCollections));
  }

  const single = shape?.data?.order?.id ?? shape?.order?.id;
  return typeof single === 'string' && single.length > 0 ? [single] : [];
}

/**
 * Kardynalność z odpowiedzi endpointu mostkowego (ogniwo 2).
 *
 * Kompatybilność wstecz jest tu świadoma: backend sprzed v1.15.0 odpowiada
 * samym skalarem `order_id`. Storefront i backend są OSOBNYMI submodułami i
 * mogą być wdrożone w różnej kolejności, więc skalar jest czytany jako
 * kolekcja jednoelementowa — nie jako brak wyniku.
 */
export function resolveBridgeOrderIds(data: unknown): string[] {
  return resolveBridgePurchase(data).orderIds;
}

/**
 * v1.15.0 Story 3.7 (AC2, AD-16) — kolekcja RAZEM z licznością kontraktu.
 *
 * Mostek odpowiada `{ orders: [...], order_count: N, ... }`
 * (`GP/backend/packages/api/src/api/store/carts/[id]/completed-order/route.ts`).
 * Do tej story storefront czytał z tej odpowiedzi WYŁĄCZNIE `orders` i wyrzucał
 * `order_count` — czyli jedyne pole, którym powierzchnia mogłaby sprawdzić, czy
 * pokazuje cały zakup, czy tylko tyle, ile udało jej się pobrać.
 *
 * `expectedOrderCount === null` znaczy „kontrakt nie podał liczności" (np.
 * backend sprzed v1.15.0, który odpowiadał samym skalarem `order_id`). To jest
 * osobny stan, a NIE zgodność — powierzchnia ma go nazwać, nie przemilczeć.
 */
export function resolveBridgePurchase(data: unknown): {
  orderIds: string[];
  expectedOrderCount: number | null;
} {
  const shape = data as
    | { orders?: unknown; order_id?: unknown; order_count?: unknown }
    | null
    | undefined;

  const rawCount = shape?.order_count;
  const expectedOrderCount =
    typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount > 0 ? rawCount : null;

  if (Array.isArray(shape?.orders)) {
    const collection = (shape.orders as BridgeOrderEntry[])
      .map(entry => entry?.order_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (collection.length > 0) {
      return { orderIds: Array.from(new Set(collection)), expectedOrderCount };
    }
  }

  const legacyScalar = shape?.order_id;
  const orderIds =
    typeof legacyScalar === 'string' && legacyScalar.length > 0 ? [legacyScalar] : [];
  return { orderIds, expectedOrderCount };
}
