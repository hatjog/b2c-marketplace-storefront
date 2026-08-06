/**
 * v1.15.0 Story 3.6 (AC3, AD-19) — rozstrzyganie RODZAJU identyfikatora, który
 * przychodzi na stronę powrotu z 3D Secure.
 *
 * ── Zmierzony stan sprzed tej story ────────────────────────────────────────
 * `return_url` to `${origin}/${locale}/order/${cart.id}/payment-status`
 * (`CartPaymentSection.tsx:101-105`) — segment `:id` jest KOSZYKIEM. Ten sam
 * segment był przekazywany dalej jako `orderId: string` do `PaymentStatusV180`
 * (`page.tsx:74`). Powierzchnia dostawała koszyk pod nazwą zamówienia i nic w
 * kontrakcie tego nie wykrywało.
 *
 * ── Reguła ─────────────────────────────────────────────────────────────────
 * Rodzaj rozstrzygamy po ROZPOZNAWALNEJ WŁASNOŚCI WARTOŚCI (prefiks nadawany
 * przez generator identyfikatorów), nie po pozycji w URL-u i nie po nazwie
 * propsa. Wartość spoza dziedziny jest BŁĘDEM Z NAZWANYM KODEM — nigdy
 * wartością domyślną i nigdy milczącym „potraktuj jak zamówienie" (AD-19:
 * wartość spoza dziedziny jest błędem, nie domyślną).
 *
 * Prefiksy grupy są sprawdzane PRZED `order_`, bo `order_group_` też zaczyna
 * się od `order_` — odwrotna kolejność cicho klasyfikowałaby grupę jako
 * zamówienie.
 */

export type PaymentReturnIdentifierKind = 'cart' | 'order' | 'order_group';

export type PaymentReturnIdentifier =
  | { kind: PaymentReturnIdentifierKind; value: string }
  | { kind: null; errorCode: 'identifier_out_of_domain'; value: string };

/**
 * review-fix (LOW) — PROWENIENCJA każdego prefiksu jest zapisana przy nim.
 *
 * Pierwsza wersja tej listy zawierała CZTERY warianty prefiksu grupy
 * (`ordgrp_`, `order_group_`, `order_set_`, `ordset_`) tam, gdzie generator
 * identyfikatorów ma jeden. Cztery warianty na jedno pojęcie to znak, że
 * wartość została zgadnięta — a AC3 wymaga rozstrzygania po ROZPOZNAWALNEJ
 * WŁASNOŚCI WARTOŚCI, nie po prawdopodobnej.
 *
 * Pomiar wykonany przy tej poprawce (`GP/backend`, zainstalowane paczki):
 *   • `@mercurjs/{core,types,cli,dashboard-sdk}` — ZERO wystąpień łańcucha
 *     `order_group`; `OrderGroupDTO`
 *     (`@mercurjs/types/dist/order-group/common.d.ts`) deklaruje samo `id: string`
 *     bez prefiksu,
 *   • `@medusajs/*` — brak definicji prefiksu grupy,
 *   • `packages/api/src` — brak definicji prefiksu.
 * Generator identyfikatora grupy NIE JEST osiągalny z tego repozytorium, więc
 * prefiksu grupy nie da się dziś zmierzyć — i to jest zapisane jako fakt, a nie
 * obejście.
 *
 * Konsekwencja dla listy: prefiksy grupy zostają (bez nich `order_group_...`
 * zaczyna się od `order_` i zostałby CICHO zaklasyfikowany jako zamówienie —
 * dokładnie ta klasa błędu, którą ten moduł ma wykrywać), ale są oznaczone jako
 * NIEZMIERZONE i ich trafienie zostawia ślad w logu. Pierwsze realne wystąpienie
 * staje się wtedy dowodem, a nie cichym potwierdzeniem zgadywanki.
 */
type PrefixProvenance = 'measured' | 'unmeasured';

const PREFIXES: ReadonlyArray<
  readonly [string, PaymentReturnIdentifierKind, PrefixProvenance]
> = [
  // Niezmierzone — patrz komentarz wyżej. Najbardziej szczegółowe najpierw,
  // bo `order_group_` też zaczyna się od `order_`.
  ['ordgrp_', 'order_group', 'unmeasured'],
  ['order_group_', 'order_group', 'unmeasured'],
  ['order_set_', 'order_group', 'unmeasured'],
  ['ordset_', 'order_group', 'unmeasured'],
  // ZMIERZONE u źródła: `return_url` budowany jako
  // `${origin}/${locale}/order/${cart?.id}/payment-status`
  // (`CartPaymentSection.tsx:101-105`) — segment `:id` jest koszykiem.
  ['cart_', 'cart', 'measured'],
  // ZMIERZONE: identyfikatory zamówień przychodzą z trasy mostkowej
  // (`order_cart.order_id`, `completed-order/route.ts`) i z fixture'ów realnego
  // PG w `completed-order-cardinality-pg.integration.test.ts`.
  ['order_', 'order', 'measured']
];

export function classifyPaymentReturnIdentifier(raw: unknown): PaymentReturnIdentifier {
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value.length === 0) {
    return { kind: null, errorCode: 'identifier_out_of_domain', value };
  }

  for (const [prefix, kind, provenance] of PREFIXES) {
    if (value.startsWith(prefix) && value.length > prefix.length) {
      if (provenance === 'unmeasured') {
        // Nie zmieniamy decyzji — zostawiamy ŚLAD. Trafienie w niezmierzony
        // prefiks jest pierwszym pomiarem, jaki to repo może o nim dostać.
        console.warn(
          `[payment-return] unmeasured_identifier_prefix prefix=${prefix} kind=${kind}`
        );
      }
      return { kind, value };
    }
  }

  return { kind: null, errorCode: 'identifier_out_of_domain', value };
}
