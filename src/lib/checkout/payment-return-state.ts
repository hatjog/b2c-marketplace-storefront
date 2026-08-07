/**
 * v1.15.0 Story 3.6 (AC2/AC3/AC4, NFR-2) — maszyna stanów POWROTU z 3D Secure.
 *
 * ── Dlaczego to w ogóle istnieje ───────────────────────────────────────────
 * Przy PEŁNYM przekierowaniu 3DS przeglądarka opuszcza stronę checkoutu, więc
 * kliencki `completeOrderAfterStripePayment` (jedyny wywołujący:
 * `StripePaymentElement.tsx:238`, wewnątrz `submitStripePayment` z
 * `redirect: 'if_required'`) NIGDY się nie wykonuje. Repo znało ten fakt
 * (`cart.ts:781-784`), ale wyciągało z niego wyłącznie wniosek o wcześniejszym
 * zapisie dowodu dostępu — nie o domknięciu koszyka. Efekt: ścieżka pełnego
 * przekierowania nie miała końca.
 *
 * Dodatkowo porzucenie uwierzytelnienia i odświeżenie strony powrotu kończą się
 * TYM SAMYM żądaniem GET na ten sam URL, a strona jest `force-dynamic` i przy
 * każdym renderze robiła dokładnie to samo. NFR-2 wymaga, żeby te dwie
 * sytuacje były ROZRÓŻNIALNE i żadna nie kończyła się ciszą.
 *
 * ── Dlaczego moduł jest czysty ─────────────────────────────────────────────
 * Decyzja jest oddzielona od I/O, żeby dało się ją zmierzyć WYKONANIEM na
 * wszystkich wejściach — łącznie z tymi, których nie da się wywołać bez żywego
 * Stripe'a (porzucony challenge). Test pęka, jeśli dwa różne wejścia zaczną
 * zwracać ten sam stan.
 */

import type { PaymentReturnIdentifier } from './payment-return-identifier';

/**
 * Parametry, które Stripe dokłada do `return_url`. Do v1.15.0 `searchParams`
 * było zadeklarowane w typie `Props` strony powrotu i NIGDY nieodczytane —
 * `redirect_status` i `payment_intent_client_secret` nie miały w repo ani
 * jednego konsumenta.
 */
export type StripeReturnParams = {
  /** POTRZEBNY: koreluje powrót z konkretną intencją płatności (diagnostyka, logi). */
  payment_intent?: string;
  /**
   * POTRZEBNY do rozstrzygnięcia: `failed` oznacza, że uwierzytelnienie zostało
   * porzucone albo odrzucone przez bank — bez tego porzucenie jest nieodróżnialne
   * od „jeszcze się nie zdążyło domknąć".
   */
  redirect_status?: string;
  /**
   * OBECNY, ale świadomie NIEUŻYWANY do decyzji: client_secret jest sekretem
   * przeglądarki i nie jest dowodem czegokolwiek po stronie serwera. Jest w
   * typie, żeby nazwać, że go widzimy i dlaczego go nie konsumujemy — a nie
   * po to, żeby dołożyć kolejny martwy mechanizm.
   */
  payment_intent_client_secret?: string;
};

export type PaymentReturnState =
  /** Koszyk domknięty, zamówienia rozwiązane. `reentry` = to jest odświeżenie/powrót. */
  | { state: 'confirmed'; orderIds: string[]; reentry: boolean }
  /** Uwierzytelnienie porzucone albo odrzucone — stan NAZWANY, nie „czekamy". */
  | { state: 'authentication_abandoned'; reason: 'redirect_status_failed' | 'completion_produced_no_order' }
  /** Płatność w toku po stronie PSP (np. async push) — jedyny stan, w którym się odpytuje. */
  | { state: 'pending_confirmation'; reason: 'awaiting_psp' | 'completion_failed' }
  /** Identyfikator spoza dziedziny — błąd z nazwanym kodem, nigdy wartość domyślna. */
  | { state: 'identifier_out_of_domain' };

/**
 * Fakty zebrane przez warstwę serwerową PRZED podjęciem decyzji.
 *
 * `ordersBeforeCompletion` jest odczytem: jeśli koszyk już był domknięty, to
 * jest odświeżenie i domknięcia NIE inicjujemy ponownie (AC4 — odświeżenie jest
 * odczytem; AC2 — idempotencja).
 */
export type PaymentReturnFacts = {
  identifier: PaymentReturnIdentifier;
  params: StripeReturnParams;
  /** Zamówienia znalezione dla koszyka PRZED próbą domknięcia. */
  ordersBeforeCompletion: string[];
  /** Czy warstwa serwerowa wykonała domknięcie w tym żądaniu. */
  completionAttempted: boolean;
  /** Zamówienia po domknięciu (puste, gdy domknięcia nie było albo nic nie dało). */
  ordersAfterCompletion: string[];
  /** Czy samo wywołanie domknięcia zwróciło porażkę transportową/workflow. */
  completionFailed: boolean;
};

export function decidePaymentReturnState(facts: PaymentReturnFacts): PaymentReturnState {
  const { identifier, params, ordersBeforeCompletion, completionAttempted } = facts;

  if (identifier.kind === null) {
    return { state: 'identifier_out_of_domain' };
  }

  // Identyfikator zamówienia — powrót prowadzi wprost na istniejące zamówienie.
  // To ZAWSZE ponowne wejście: zamówienie już istnieje, nie ma czego domykać.
  if (identifier.kind === 'order') {
    return { state: 'confirmed', orderIds: [identifier.value], reentry: true };
  }

  // Koszyk już domknięty ⇒ odświeżenie / cofnięcie strony. Czysty ODCZYT.
  if (ordersBeforeCompletion.length > 0) {
    return { state: 'confirmed', orderIds: ordersBeforeCompletion, reentry: true };
  }

  // Stripe powiedział wprost, że uwierzytelnienie się nie powiodło. Domykania
  // nie próbujemy — nie ma czego domykać, a cisza byłaby naruszeniem NFR-2.
  if (params.redirect_status === 'failed') {
    return { state: 'authentication_abandoned', reason: 'redirect_status_failed' };
  }

  if (!completionAttempted) {
    return { state: 'pending_confirmation', reason: 'awaiting_psp' };
  }

  if (facts.completionFailed) {
    return { state: 'pending_confirmation', reason: 'completion_failed' };
  }

  if (facts.ordersAfterCompletion.length > 0) {
    // Pierwsze wejście po udanym uwierzytelnieniu: koszyk domknięty TUTAJ,
    // serwerowo, niezależnie od tego, czy kod klienta się dokończył.
    return { state: 'confirmed', orderIds: facts.ordersAfterCompletion, reentry: false };
  }

  // Domknięcie wykonane, ale zamówienie nie powstało — płatność nie została
  // pobrana. To jest porzucenie, nie „czekamy w nieskończoność".
  return { state: 'authentication_abandoned', reason: 'completion_produced_no_order' };
}

/** Klucz i18n stanu — jeden punkt mapowania stan → namespace `payment_status`. */
export function paymentReturnStateKey(state: PaymentReturnState['state']): string {
  return `return_${state}`;
}
