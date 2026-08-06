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
  const shape = data as { orders?: unknown; order_id?: unknown } | null | undefined;

  if (Array.isArray(shape?.orders)) {
    const collection = (shape.orders as BridgeOrderEntry[])
      .map(entry => entry?.order_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (collection.length > 0) {
      return Array.from(new Set(collection));
    }
  }

  const legacyScalar = shape?.order_id;
  return typeof legacyScalar === 'string' && legacyScalar.length > 0 ? [legacyScalar] : [];
}
