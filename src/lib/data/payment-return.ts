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

import { completeOrderAfterStripePayment, getCompletedOrderIdsForCart } from './cart';

/**
 * Znacznik „byłam już u Route Handlera". Bez niego strona, dla której
 * domknięcie nie dało zamówienia, odsyłałaby do handlera w nieskończoność.
 * Obecność znacznika czyni z powrotu czysty ODCZYT.
 */
export const PAYMENT_RETURN_DONE_PARAM = 'gp_return';
const PAYMENT_RETURN_DONE_VALUE = 'done';

/** Ścieżka Route Handlera domykającego koszyk. Jedno miejsce, jedna prawda. */
export const PAYMENT_RETURN_COMPLETION_PATH = '/api/v1/checkout/payment-return';

/** Wyciąga pojedynczą wartość z `searchParams` Next.js (powtórzony parametr = tablica). */
function firstParam(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) {
    // Powtórzony parametr powrotu jest podejrzany — nie zgadujemy, który jest
    // „prawdziwy", bierzemy pierwszy i nie budujemy na nim decyzji o sukcesie.
    return raw[0];
  }
  return raw;
}

export async function readStripeReturnParams(
  searchParams: Record<string, string | string[]> | undefined
): Promise<StripeReturnParams> {
  return {
    payment_intent: firstParam(searchParams?.payment_intent),
    redirect_status: firstParam(searchParams?.redirect_status),
    payment_intent_client_secret: firstParam(searchParams?.payment_intent_client_secret)
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
  return params.redirect_status === 'succeeded' || Boolean(params.payment_intent);
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

  const nonCart = (): PaymentReturnResolution => ({
    identifier,
    params,
    completionRedirect: null,
    result: decidePaymentReturnState({
      identifier,
      params,
      ordersBeforeCompletion: [],
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
  const alreadyDone =
    firstParam(searchParams?.[PAYMENT_RETURN_DONE_PARAM]) === PAYMENT_RETURN_DONE_VALUE;

  let ordersBeforeCompletion: string[] = [];
  try {
    ordersBeforeCompletion = await getCompletedOrderIdsForCart(identifier.value, { attempts: 2 });
  } catch (error) {
    // Odmowa musi być widoczna (NFR-2) — nie połykamy jej po cichu.
    console.warn(`[payment-return] bridge read failed cart=${identifier.value}`, error);
  }

  const alreadyCompleted = ordersBeforeCompletion.length > 0;
  const confirmedByStripe = await isStripeReturnConfirmation(params);
  const abandoned = params.redirect_status === 'failed';

  // ── 2. DECYZJA O DOMKNIĘCIU (wykonuje ją Route Handler, nie render) ──────
  const needsCompletion = !alreadyCompleted && !abandoned && confirmedByStripe && !alreadyDone;

  if (needsCompletion) {
    return {
      identifier,
      params,
      completionRedirect: buildCompletionRedirect(locale, identifier.value, params),
      result: decidePaymentReturnState({
        identifier,
        params,
        ordersBeforeCompletion,
        completionAttempted: false,
        ordersAfterCompletion: [],
        completionFailed: false
      })
    };
  }

  return {
    identifier,
    params,
    completionRedirect: null,
    result: decidePaymentReturnState({
      identifier,
      params,
      ordersBeforeCompletion,
      // Powrót ZE znacznikiem `gp_return=done` znaczy, że domknięcie było
      // próbowane i nie dało zamówienia — to jest fakt, nie brak faktu.
      // Bez tego stan spadałby na `awaiting_psp` i gubił rozróżnienie NFR-2.
      completionAttempted: alreadyDone,
      ordersAfterCompletion: [],
      completionFailed: false
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
export async function performPaymentReturnCompletion(cartId: string): Promise<{
  orderIds: string[];
  completionFailed: boolean;
}> {
  const completion = await completeOrderAfterStripePayment(cartId);

  if (completion.ok) {
    return { orderIds: completion.orderIds ?? [], completionFailed: false };
  }

  console.warn(
    `[payment-return] server completion cart=${cartId} code=${completion.error?.code ?? 'unknown'}`
  );
  return {
    orderIds: [],
    completionFailed: completion.error?.code === 'completion_failed'
  };
}
