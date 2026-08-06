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

/** Prefiksy w kolejności rozstrzygania — najbardziej szczegółowe najpierw. */
const PREFIXES: ReadonlyArray<readonly [string, PaymentReturnIdentifierKind]> = [
  ['ordgrp_', 'order_group'],
  ['order_group_', 'order_group'],
  ['order_set_', 'order_group'],
  ['ordset_', 'order_group'],
  ['cart_', 'cart'],
  ['order_', 'order']
];

export function classifyPaymentReturnIdentifier(raw: unknown): PaymentReturnIdentifier {
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value.length === 0) {
    return { kind: null, errorCode: 'identifier_out_of_domain', value };
  }

  for (const [prefix, kind] of PREFIXES) {
    if (value.startsWith(prefix) && value.length > prefix.length) {
      return { kind, value };
    }
  }

  return { kind: null, errorCode: 'identifier_out_of_domain', value };
}
