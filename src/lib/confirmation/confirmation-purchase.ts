/**
 * v1.15.0 Story 3.7 (AC1, AD-16, AD-19) — NOŚNIK KOLEKCJI na trasie
 * potwierdzenia.
 *
 * ── Dlaczego to jest osobny problem od „komponent renderuje kolekcję" ──────
 * Trasa `/[locale]/order/[id]/confirmed` niesie JEDEN segment. Do tej story
 * `page.tsx:38` robiło `<ConfirmationPageContent orderId={params.id} />`,
 * a powierzchnia statusu płatności nawigowała tu przez
 * `/order/${orderId}/confirmed` — czyli przez identyfikator JEDNEGO zamówienia.
 * Naprawa samego komponentu nic by nie dała: drugie zamówienie nie miałoby jak
 * do niego dojechać (AC1 nazywa to wprost).
 *
 * ── Rozstrzygnięcie i uzasadnienie ─────────────────────────────────────────
 * Rozważane były trzy nośniki:
 *
 *  (a) lista identyfikatorów w URL-u (`?orders=a,b`) — ODRZUCONE: kolekcja
 *      w query stringu jest podrabialna przez każdego, kto zna format, a strona
 *      potwierdzenia pokazuje dane zamówienia. Nośnik musiałby być
 *      weryfikowany po stronie serwera, czyli i tak sprowadzałby się do (b),
 *      tylko z dodatkową powierzchnią ataku,
 *  (b) trasa zbiorcza / nowy segment (`/order/group/[id]/confirmed`) —
 *      ODRZUCONE: identyfikator grupy zakupu NIE JEST dziś osiągalny z tego
 *      repozytorium (pomiar Story 3.6, `payment-return-identifier.ts`: prefiksy
 *      grupy są oznaczone jako NIEZMIERZONE, bo generator nie istnieje ani
 *      w `@mercurjs/*`, ani w `packages/api/src`). Trasa oparta na wartości,
 *      której nikt nie produkuje, byłaby martwym mechanizmem od pierwszego dnia,
 *  (c) **WYBRANE — segment `[id]` niesie IDENTYFIKATOR ZAKUPU, a serwer
 *      rozwija go w kolekcję.** Ten sam koszyk, który jest już segmentem trasy
 *      powrotu z 3DS (`return_url` → `/order/${cart.id}/payment-status`),
 *      zostaje segmentem trasy potwierdzenia. Rozwinięcie robi mostek
 *      `GET /store/carts/:id/completed-order`, który Story 3.6 zbudowała
 *      WŁAŚNIE po to, żeby nieść kardynalność — i który niesie też `order_count`.
 *
 * Konsekwencje (c) są jawne:
 *  • żadne ogniwo nawigacji nie redukuje N→1 — segment jest zakupem, nie
 *    zamówieniem,
 *  • liczność przyjeżdża RAZEM z kolekcją, więc AC2 ma czym mierzyć,
 *  • linki zastane (`/order/<order_id>/confirmed` z maila i historii) DALEJ
 *    działają: identyfikator zamówienia jest rozpoznawany po prefiksie i daje
 *    świadomy DRILL-DOWN (AD-16 dopuszcza redukcję N→1 właśnie jako drill-down).
 *    Drill-down jest NAZWANY na powierzchni, a nie udawany jako całość zakupu.
 *
 * Ten moduł jest CZYSTY (bez sieci, bez `'use server'`), żeby decyzja dała się
 * zmierzyć wykonaniem, a nie tylko przeczytać.
 */

import type { PaymentReturnIdentifier } from '@/lib/checkout/payment-return-identifier';

export type ConfirmationPurchase =
  /** Cały zakup — kolekcja rozwinięta z identyfikatora zakupu. */
  | { kind: 'collection'; orderIds: string[]; expectedOrderCount: number | null }
  /**
   * Jedno zamówienie, świadomie (link zastany). AD-16: redukcja N→1 wyłącznie
   * jako drill-down — i powierzchnia MA to powiedzieć, a nie udawać całość.
   */
  | { kind: 'drilldown'; orderIds: string[]; expectedOrderCount: null }
  /** Identyfikator zakupu znany, ale nie ma dla niego ŻADNEGO zamówienia. */
  | { kind: 'purchase_not_found'; value: string }
  /**
   * ODCZYT ZAKUPU SIĘ NIE UDAŁ — osobny stan od „nie ma takiego zakupu".
   *
   * Story 3.7 review-fix (HIGH-3, AD-19, AC3). Do tej poprawki awaria mostka
   * i pusty zakup dawały ten sam `purchase_not_found`, więc kupująca po
   * obciążeniu karty czytała „link jest nieaktualny" także wtedy, gdy backend
   * leżał. To jest dokładnie ta zamiana awarii w ciszę, którą ta story usuwa
   * w BFF `/api/v1/entitlements` — tylko o warstwę wyżej i na ścieżce
   * serwerowej, gdzie żaden `page.route()` jej nie odsłoni.
   */
  | { kind: 'read_failed'; value: string }
  /** Wartość spoza dziedziny — BŁĄD, nie wartość domyślna (AD-19). */
  | { kind: 'out_of_domain'; value: string };

export interface BridgePurchaseRead {
  orderIds: string[];
  expectedOrderCount: number | null;
  /**
   * `true` znaczy „ostatnia próba odczytu mostka skończyła się porażką"
   * (HTTP 5xx/4xx inne niż 404, albo awaria transportu). Pusta kolekcja
   * BEZ tej flagi jest stanem dziedziny, nie awarią.
   */
  readFailed?: boolean;
}

/**
 * Rozstrzyga, co powierzchnia potwierdzenia ma pokazać dla danego segmentu trasy.
 *
 * `bridge === null` znaczy „odczytu mostka NIE UDAŁO SIĘ wykonać" — i wtedy
 * wynikiem jest `read_failed`, a NIE `purchase_not_found`. To samo dla
 * `bridge.readFailed === true` (odpowiedź przyszła, ale była porażką HTTP).
 * `purchase_not_found` zostaje zarezerwowane dla UDANEGO odczytu, który zwrócił
 * pustą kolekcję — czyli dla realnego stanu dziedziny.
 */
export function decideConfirmationPurchase(input: {
  identifier: PaymentReturnIdentifier;
  bridge: BridgePurchaseRead | null;
}): ConfirmationPurchase {
  const { identifier, bridge } = input;

  if (identifier.kind === null) {
    return { kind: 'out_of_domain', value: identifier.value };
  }

  if (identifier.kind === 'order') {
    return { kind: 'drilldown', orderIds: [identifier.value], expectedOrderCount: null };
  }

  if (identifier.kind === 'order_group') {
    // Prefiksy grupy są w tym repo NIEZMIERZONE (patrz nagłówek modułu i
    // `payment-return-identifier.ts`). Nie ma czym rozwinąć grupy w kolekcję,
    // więc nie udajemy, że umiemy — to jest wartość spoza osiągalnej dziedziny.
    return { kind: 'out_of_domain', value: identifier.value };
  }

  if (!bridge || bridge.readFailed === true) {
    return { kind: 'read_failed', value: identifier.value };
  }

  if (bridge.orderIds.length === 0) {
    return { kind: 'purchase_not_found', value: identifier.value };
  }

  return {
    kind: 'collection',
    orderIds: bridge.orderIds,
    expectedOrderCount: bridge.expectedOrderCount
  };
}
