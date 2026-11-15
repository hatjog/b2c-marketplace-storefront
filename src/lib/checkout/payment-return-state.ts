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
  ambiguous: boolean;
};

export type PaymentReturnState =
  /** Koszyk domknięty, zamówienia rozwiązane. `reentry` = to jest odświeżenie/powrót. */
  | { state: 'confirmed'; orderIds: string[]; reentry: boolean }
  /** Uwierzytelnienie porzucone albo odrzucone — stan NAZWANY, nie „czekamy". */
  | {
      state: 'authentication_abandoned';
      reason: 'redirect_status_failed' | 'completion_produced_no_order';
    }
  /** Płatność w toku po stronie PSP (np. async push) — jedyny stan, w którym się odpytuje. */
  | {
      state: 'pending_confirmation';
      reason:
        | 'awaiting_psp'
        | 'return_interrupted'
        | 'completion_failed'
        | 'psp_not_terminal'
        | 'completion_in_progress';
    }
  /** Odczyt nie dowiódł kompletnego zakupu; mutacja byłaby niebezpieczna. */
  | {
      state: 'recovery_required';
      reason:
        | 'bridge_read_failed'
        | 'bridge_access_denied'
        | 'incomplete_order_set'
        | 'bridge_malformed'
        | 'outcome_marker_unavailable'
        | 'outcome_marker_capacity_exhausted'
        | 'cart_unavailable';
    }
  | {
      state: 'return_refused';
      reason:
        | 'identifier_out_of_domain'
        | 'not_a_cart'
        | 'no_stripe_confirmation'
        | 'cart_ownership_unproven'
        | 'payment_intent_mismatch'
        | 'ambiguous_return_parameters';
    }
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
  /** Rozstrzygnięcie odczytu mostka przed mutacją. */
  bridgeReadState:
    | 'complete'
    | 'empty'
    | 'incomplete'
    | 'malformed'
    | 'read_failed'
    | 'access_denied';
  /** Czy warstwa serwerowa wykonała domknięcie w tym żądaniu. */
  completionAttempted: boolean;
  /** Zamówienia po domknięciu (puste, gdy domknięcia nie było albo nic nie dało). */
  ordersAfterCompletion: string[];
  /** Czy samo wywołanie domknięcia zwróciło porażkę transportową/workflow. */
  completionFailed: boolean;
};

export function decidePaymentReturnState(facts: PaymentReturnFacts): PaymentReturnState {
  const { identifier, params, ordersBeforeCompletion, completionAttempted, bridgeReadState } =
    facts;

  if (identifier.kind === null) {
    return { state: 'identifier_out_of_domain' };
  }

  // Identyfikator zamówienia — powrót prowadzi wprost na istniejące zamówienie.
  // To ZAWSZE ponowne wejście: zamówienie już istnieje, nie ma czego domykać.
  if (identifier.kind === 'order') {
    return { state: 'confirmed', orderIds: [identifier.value], reentry: true };
  }

  if (bridgeReadState === 'read_failed') {
    return { state: 'recovery_required', reason: 'bridge_read_failed' };
  }

  if (bridgeReadState === 'access_denied') {
    return { state: 'recovery_required', reason: 'bridge_access_denied' };
  }

  if (bridgeReadState === 'incomplete') {
    return { state: 'recovery_required', reason: 'incomplete_order_set' };
  }

  if (bridgeReadState === 'malformed') {
    return { state: 'recovery_required', reason: 'bridge_malformed' };
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
    // Story 8.3 (AC1): powrót NIESIE intencję płatności, ale domknięcie nie
    // zostało podjęte (np. `redirect_status` inny niż `succeeded`, urwany
    // powrót). To jest przerwanie, a nie „nigdy nierozpoczęte" — do 8.3 oba
    // zlewały się w jeden `awaiting_psp`.
    if (params.payment_intent) {
      return { state: 'pending_confirmation', reason: 'return_interrupted' };
    }
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

/**
 * Story 8.3 (AC1, FR-15) — trzy rozłączne cykle życia powrotu.
 *
 *  - `success`        — zakup potwierdzony (`confirmed`);
 *  - `never_started`  — brak JAKIEGOKOLWIEK śladu płatności w powrocie
 *                       (bez `payment_intent`, bez `redirect_status`) i brak
 *                       podjętego domknięcia: `pending_confirmation/awaiting_psp`
 *                       albo identyfikator spoza dziedziny bez parametrów;
 *  - `interrupted`    — każdy inny stan: powrót się zaczął i urwał.
 *
 * Przerwany NIGDY nie jest `success`: sukces wymaga stanu `confirmed`.
 */
export type PaymentReturnLifecycle = 'success' | 'interrupted' | 'never_started';

export function paymentReturnLifecycle(
  result: PaymentReturnState,
  params: Pick<StripeReturnParams, 'payment_intent' | 'redirect_status'>
): PaymentReturnLifecycle {
  if (result.state === 'confirmed') return 'success';
  const noPaymentTrace = !params.payment_intent && !params.redirect_status;
  if (
    noPaymentTrace &&
    result.state === 'pending_confirmation' &&
    result.reason === 'awaiting_psp'
  ) {
    return 'never_started';
  }
  return 'interrupted';
}

/**
 * Story 8.3 (AC1, ADR-233) — fakt „czy pobrano" z odczytu PSP po stronie
 * BACKENDU (`GET /store/carts/:id/payment-charge`), nigdy z `redirect_status`.
 * Błąd odczytu ⇒ `unknown`, nigdy domyślnie `not_charged`.
 */
export type PaymentChargeFact = 'charged' | 'not_charged' | 'unknown';

export function parsePaymentChargeFact(raw: unknown): PaymentChargeFact {
  const charge = (raw as { charge?: unknown } | null | undefined)?.charge;
  return charge === 'charged' || charge === 'not_charged' ? charge : 'unknown';
}

/** Klucz i18n komunikatu o pobraniu — namespace `payment_status`. */
export function paymentChargeMessageKey(charge: PaymentChargeFact): string {
  return `return_charge.${charge}`;
}
