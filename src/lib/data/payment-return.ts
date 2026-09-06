'use server';

/**
 * v1.15.0 Story 3.6 (AC2/AC3/AC4) — SERWEROWE domknięcie koszyka na ścieżce
 * powrotu z 3D Secure.
 *
 * ── Co to naprawia ─────────────────────────────────────────────────────────
 * Przy pełnym przekierowaniu 3DS przeglądarka opuszcza stronę checkoutu, więc
 * kliencki `completeOrderAfterStripePayment` (jedyny wywołujący:
 * `StripePaymentElement.tsx:238`) nigdy się nie wykonuje. Do v1.15.0 nie było
 * NICZEGO, co domykałoby koszyk po powrocie — ścieżka wyglądała na działającą
 * tylko dlatego, że karta testowa bez wymuszonego 3DS wraca inline
 * (`redirect: 'if_required'`, `StripePaymentElement.tsx:143`).
 *
 * ── review-fix (HIGH): GDZIE wolno domykać ─────────────────────────────────
 * Pierwsza wersja tej story wołała domknięcie WPROST z `PaymentStatusPage`,
 * czyli z fazy renderu React Server Component. To jest martwy mechanizm na
 * realnej ścieżce: `completeOrderAfterStripePayment` wykonuje w środku
 * `revalidateTag` / `revalidatePath` (`cart.ts`) oraz `cookies().set(...)`
 * (`setCompletedCartId`, `removeCartId`), a Next.js 15 zabrania obu w renderze
 * (`Route ... used "revalidateTag" during render which is unsupported`,
 * `Cookies can only be modified in a Server Action or Route Handler`). Wyjątek
 * leciał PO udanym `POST /complete`, więc zamówienia powstawały, wyjątek łapał
 * `catch` w `cart.ts`, a kupująca po pobranej płatności widziała „czekamy na
 * potwierdzenie z banku" i — bo `setCompletedCartId` się nie wykonało —
 * traciła dostęp do statusu własnego zamówienia (401).
 *
 * Dlatego moduł jest rozdzielony na DWIE funkcje o różnych uprawnieniach:
 *
 *  • `resolvePaymentReturn` — CZYSTY ODCZYT. Wolno ją wołać z renderu; nie
 *    dotyka cache'u ani cookies. Gdy stwierdzi, że koszyk trzeba domknąć, NIE
 *    domyka go — zwraca `completionRedirect`, czyli adres Route Handlera.
 *  • `performPaymentReturnCompletion` — MUTACJA. Wolno ją wołać WYŁĄCZNIE
 *    z Route Handlera (`/api/v1/checkout/payment-return`), gdzie zapis cookie
 *    i unieważnianie cache'u są legalne.
 *
 * Granica jest pilnowana wykonaniem: `__tests__/payment-status-render.test.ts`
 * renderuje stronę z `next/cache` i `next/headers` uzbrojonymi tak, żeby
 * RZUCAŁY dokładnie tymi błędami, którymi rzuca Next w renderze. Test pęka,
 * gdy ktokolwiek wróci z mutacją do fazy renderu.
 *
 * ── Kontrakt ───────────────────────────────────────────────────────────────
 * 1. NAJPIERW ODCZYT. Jeśli koszyk jest już domknięty, zwracamy `confirmed`
 *    z `reentry: true` i NIE inicjujemy niczego — odświeżenie jest odczytem.
 * 2. Domknięcie inicjujemy tylko wtedy, gdy odczyt nic nie zastał, a Stripe
 *    potwierdził powrót (`redirect_status=succeeded` albo `payment_intent`).
 * 3. Ścieżka inline (`redirect: 'if_required'`) zostaje NIETKNIĘTA — obie
 *    współistnieją i obie kończą się tym samym stanem.
 * 4. Koszyk NIE jest mutowany między `confirmCardPayment` a `/complete`
 *    (`cart.ts:986-990`: `updateCartWorkflow` potrafi skasować sesje płatności
 *    ⇒ osierocone obciążenie). Ten moduł wyłącznie czyta i domyka.
 *
 * Nie powstaje tu żadna powierzchnia zapisu poza HTTP (job/subscriber/worker),
 * więc nośnik kontekstu rynku z AD-21/ADR-177 nie ma tu zastosowania — cała
 * ścieżka biegnie w żądaniu HTTP, które kontekst rynku już niesie.
 */
import {
  classifyPaymentReturnIdentifier,
  type PaymentReturnIdentifier
} from '@/lib/checkout/payment-return-identifier';
import {
  decidePaymentReturnState,
  type PaymentReturnState,
  type StripeReturnParams
} from '@/lib/checkout/payment-return-state';

import {
  cartHasStripePaymentIntent,
  completeOrderAfterStripePayment,
  getCompletedPurchaseForCart,
  type CompletedPurchaseRead
} from './cart';
import { getPaymentReturnOutcome, provesCartOwnership } from './cookies';
import { PAYMENT_RETURN_COMPLETION_PATH } from './payment-return-constants';

// Stale mieszkaja w `./payment-return-constants` — plik z `'use server'` moze
// eksportowac WYLACZNIE funkcje asynchroniczne, a eksport stalej stad wywalal
// kompilacje calego grafu modulow (500 na `/pl`, `/pl/categories`, `/pl/cart`).
// Re-eksport tez by nie przeszedl: to nadal eksport nie-funkcji.

function singleParam(raw: string | string[] | undefined): { value: string | undefined; ambiguous: boolean } {
  if (!Array.isArray(raw)) {
    return { value: raw, ambiguous: false };
  }
  if (raw.length === 1) {
    return { value: raw[0], ambiguous: false };
  }
  return { value: undefined, ambiguous: raw.length > 1 };
}

export async function readStripeReturnParams(
  searchParams: Record<string, string | string[]> | undefined
): Promise<StripeReturnParams> {
  const paymentIntent = singleParam(searchParams?.payment_intent);
  const redirectStatus = singleParam(searchParams?.redirect_status);
  const clientSecret = singleParam(searchParams?.payment_intent_client_secret);
  return {
    payment_intent: paymentIntent.value,
    redirect_status: redirectStatus.value,
    payment_intent_client_secret: clientSecret.value,
    ambiguous: paymentIntent.ambiguous || redirectStatus.ambiguous || clientSecret.ambiguous
  };
}

/**
 * Czy ten powrót w ogóle wygląda na powrót ze Stripe'a?
 *
 * review-fix (HIGH — nieuwierzytelniona powierzchnia zapisu): warunkiem
 * domknięcia było wcześniej samo `redirect_status !== 'failed'`, czyli BRAK
 * parametrów też przechodził. Zwykłe wejście na URL (bot, prefetch, skaner
 * linków, historia przeglądarki) inicjowało wtedy `POST /complete`. Domknięcie
 * wymaga teraz POZYTYWNEGO sygnału od Stripe'a, nie braku sygnału negatywnego.
 */
export async function isStripeReturnConfirmation(params: StripeReturnParams): Promise<boolean> {
  return !params.ambiguous && params.redirect_status === 'succeeded' && Boolean(params.payment_intent);
}

export type PaymentReturnOutcome =
  | 'done'
  | 'completion_failed'
  | 'no_order_id'
  | 'malformed'
  | 'read_failed'
  | 'access_denied'
  | 'incomplete'
  | 'identifier_out_of_domain'
  | 'not_a_cart'
  | 'no_stripe_confirmation'
  | 'cart_ownership_unproven'
  | 'payment_intent_mismatch'
  | 'ambiguous_return_parameters';

function priorOutcome(value: string | undefined): PaymentReturnOutcome | null {
  return value === 'done' ||
    value === 'completion_failed' ||
    value === 'no_order_id' ||
    value === 'malformed' ||
    value === 'read_failed' ||
    value === 'access_denied' ||
    value === 'incomplete' ||
    value === 'identifier_out_of_domain' ||
    value === 'not_a_cart' ||
    value === 'no_stripe_confirmation' ||
    value === 'cart_ownership_unproven' ||
    value === 'payment_intent_mismatch' ||
    value === 'ambiguous_return_parameters'
    ? value
    : null;
}

function refusalState(outcome: PaymentReturnOutcome | null): PaymentReturnState | null {
  if (
    outcome === 'identifier_out_of_domain' ||
    outcome === 'not_a_cart' ||
    outcome === 'no_stripe_confirmation' ||
    outcome === 'cart_ownership_unproven' ||
    outcome === 'payment_intent_mismatch' ||
    outcome === 'ambiguous_return_parameters'
  ) {
    return { state: 'return_refused', reason: outcome };
  }
  return null;
}

export type PaymentReturnResolution = {
  identifier: PaymentReturnIdentifier;
  params: StripeReturnParams;
  result: PaymentReturnState;
  /**
   * Adres Route Handlera, gdy koszyk wymaga domknięcia. `null`, gdy nie ma
   * czego domykać albo domknięcie już było próbowane w tym powrocie.
   *
   * Strona ma go WYKONAĆ (`redirect()`), a nie interpretować — mutacja nie
   * należy do renderu.
   */
  completionRedirect: string | null;
};

function buildCompletionRedirect(
  locale: string,
  cartId: string,
  params: StripeReturnParams
): string {
  const query = new URLSearchParams({ cart_id: cartId, locale });
  if (params.redirect_status) {
    query.set('redirect_status', params.redirect_status);
  }
  if (params.payment_intent) {
    query.set('payment_intent', params.payment_intent);
  }
  return `${PAYMENT_RETURN_COMPLETION_PATH}?${query.toString()}`;
}

/**
 * Rozstrzyga powrót z 3DS: rodzaj identyfikatora, stan i kolekcję zamówień.
 *
 * CZYSTY ODCZYT — bezpieczna w fazie renderu RSC. Zwraca ZAWSZE nazwany stan —
 * nigdy `null`, nigdy cichego „potraktuj jak zamówienie" (AD-19, NFR-2).
 */
export async function resolvePaymentReturn(
  rawIdentifier: unknown,
  searchParams: Record<string, string | string[]> | undefined,
  locale: string
): Promise<PaymentReturnResolution> {
  const identifier = classifyPaymentReturnIdentifier(rawIdentifier);
  const params = await readStripeReturnParams(searchParams);
  const outcome = priorOutcome(await getPaymentReturnOutcome(identifier.value, params.payment_intent));
  const refused = params.ambiguous
    ? { state: 'return_refused' as const, reason: 'ambiguous_return_parameters' as const }
    : refusalState(outcome);

  if (refused) {
    return { identifier, params, completionRedirect: null, result: refused };
  }

  const nonCart = (): PaymentReturnResolution => ({
    identifier,
    params,
    completionRedirect: null,
    result: decidePaymentReturnState({
      identifier,
      params,
      ordersBeforeCompletion: [],
      bridgeReadState: 'empty',
      completionAttempted: false,
      ordersAfterCompletion: [],
      completionFailed: false
    })
  });

  if (identifier.kind === null) {
    console.warn(
      `[payment-return] identifier_out_of_domain payment_intent=${params.payment_intent ?? 'none'}`
    );
    return nonCart();
  }

  if (identifier.kind !== 'cart') {
    return nonCart();
  }

  if (!(await provesCartOwnership(identifier.value))) {
    return {
      identifier,
      params,
      completionRedirect: null,
      result: { state: 'return_refused', reason: 'cart_ownership_unproven' }
    };
  }

  // ── 1. ODCZYT ────────────────────────────────────────────────────────────
  //
  // review-fix (MEDIUM): odczyt ma retry. Join `order_set`↔cart potrafi
  // opóźnić się o kilkaset ms po domknięciu, a to jest DOKŁADNIE ten odczyt,
  // którym ścieżka powrotu rozstrzyga idempotencję. Jedno podejście bez
  // czekania zwracało `[]` dla koszyka JUŻ domkniętego i ścieżka powrotu
  // inicjowała ponowne domknięcie zamiast odczytu.
  //
  // 2 podejścia, nie 4: przy pierwszym wejściu (koszyk faktycznie niedomknięty)
  // każde podejście to czysty koszt — 350 ms opóźnienia przed domknięciem.
  // Dwa podejścia pokrywają lag joina, nie blokując kupującej na 1,4 s.
  let bridge: CompletedPurchaseRead = {
    orderIds: [],
    expectedOrderCount: null,
    state: 'read_failed',
    readFailed: true
  };
  try {
    bridge = await getCompletedPurchaseForCart(identifier.value, { attempts: 2 });
  } catch (error) {
    console.warn(`[payment-return] bridge read failed cart=${identifier.value}`, error);
  }

  const alreadyCompleted = bridge.state === 'complete';
  const confirmedByStripe = await isStripeReturnConfirmation(params);
  const abandoned = params.redirect_status === 'failed';

  // ── 2. DECYZJA O DOMKNIĘCIU (wykonuje ją Route Handler, nie render) ──────
  const needsCompletion =
    !alreadyCompleted &&
    bridge.state === 'empty' &&
    !abandoned &&
    confirmedByStripe &&
    outcome === null;

  if (needsCompletion) {
    return {
      identifier,
      params,
      completionRedirect: buildCompletionRedirect(locale, identifier.value, params),
      result: decidePaymentReturnState({
        identifier,
        params,
        ordersBeforeCompletion: bridge.orderIds,
        bridgeReadState: bridge.state,
        completionAttempted: false,
        ordersAfterCompletion: [],
        completionFailed: false
      })
    };
  }

  if (!alreadyCompleted && outcome === 'read_failed') {
    return {
      identifier,
      params,
      completionRedirect: null,
      result: { state: 'recovery_required', reason: 'bridge_read_failed' }
    };
  }

  if (!alreadyCompleted && outcome === 'access_denied') {
    return {
      identifier,
      params,
      completionRedirect: null,
      result: { state: 'recovery_required', reason: 'bridge_access_denied' }
    };
  }

  if (!alreadyCompleted && (outcome === 'incomplete' || outcome === 'malformed')) {
    return {
      identifier,
      params,
      completionRedirect: null,
      result: {
        state: 'recovery_required',
        reason: outcome === 'malformed' ? 'bridge_malformed' : 'incomplete_order_set'
      }
    };
  }

  return {
    identifier,
    params,
    completionRedirect: null,
    result: decidePaymentReturnState({
      identifier,
      params,
      ordersBeforeCompletion: bridge.orderIds,
      bridgeReadState: bridge.state,
      // Powrót ZE znacznikiem `gp_return=done` znaczy, że domknięcie było
      // próbowane i nie dało zamówienia — to jest fakt, nie brak faktu.
      // Bez tego stan spadałby na `awaiting_psp` i gubił rozróżnienie NFR-2.
      completionAttempted:
        outcome === 'done' || outcome === 'completion_failed' || outcome === 'no_order_id',
      ordersAfterCompletion: [],
      completionFailed: outcome === 'completion_failed'
    })
  };
}

/**
 * MUTACJA — domknięcie koszyka. Wolno wołać WYŁĄCZNIE z Route Handlera.
 *
 * Nie jest wołana z renderu i nie wolno jej stamtąd wołać: w środku siedzą
 * `revalidateTag`/`revalidatePath` i zapis cookies, których Next.js w renderze
 * zabrania (patrz nagłówek modułu).
 */
type PaymentReturnCompletion = {
  orderIds: string[];
  outcome: Extract<PaymentReturnOutcome, 'done' | 'completion_failed' | 'no_order_id' | 'incomplete'>;
};

const completionLocks = new Map<string, Promise<PaymentReturnCompletion>>();

async function completePaymentReturn(cartId: string): Promise<PaymentReturnCompletion> {
  const completion = await completeOrderAfterStripePayment(cartId);

  if (completion.ok && completion.orderIds.length > 0) {
    return { orderIds: completion.orderIds ?? [], outcome: 'done' };
  }

  console.warn(
    `[payment-return] server completion cart=${cartId} code=${completion.error?.code ?? 'unknown'}`
  );
  return {
    orderIds: [],
    outcome:
      completion.error?.code === 'completion_failed'
        ? 'completion_failed'
        : completion.error?.code === 'incomplete_order_set'
          ? 'incomplete'
          : 'no_order_id'
  };
}

export async function performPaymentReturnCompletion(cartId: string): Promise<PaymentReturnCompletion> {
  const existing = completionLocks.get(cartId);
  if (existing) {
    return existing;
  }

  const current = completePaymentReturn(cartId).finally(() => completionLocks.delete(cartId));
  completionLocks.set(cartId, current);
  return current;
}

export async function isPaymentIntentBoundToCart(cartId: string, paymentIntent: string): Promise<boolean> {
  return cartHasStripePaymentIntent(cartId, paymentIntent);
}
