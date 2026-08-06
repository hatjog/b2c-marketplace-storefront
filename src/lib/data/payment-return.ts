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
 * ── Kontrakt ───────────────────────────────────────────────────────────────
 * 1. NAJPIERW ODCZYT. Jeśli koszyk jest już domknięty, zwracamy `confirmed`
 *    z `reentry: true` i NIE inicjujemy niczego — odświeżenie jest odczytem.
 * 2. Domknięcie inicjujemy tylko wtedy, gdy odczyt nic nie zastał, a Stripe nie
 *    zgłosił `redirect_status=failed`.
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
 * Rozstrzyga powrót z 3DS: rodzaj identyfikatora, stan i kolekcję zamówień.
 *
 * Zwraca ZAWSZE nazwany stan — nigdy `null`, nigdy cichego „potraktuj jak
 * zamówienie" (AD-19, NFR-2).
 */
export async function resolvePaymentReturn(
  rawIdentifier: unknown,
  searchParams: Record<string, string | string[]> | undefined
): Promise<{ identifier: PaymentReturnIdentifier; params: StripeReturnParams; result: PaymentReturnState }> {
  const identifier = classifyPaymentReturnIdentifier(rawIdentifier);
  const params = await readStripeReturnParams(searchParams);

  if (identifier.kind === null) {
    console.warn(
      `[payment-return] identifier_out_of_domain payment_intent=${params.payment_intent ?? 'none'}`
    );
    return {
      identifier,
      params,
      result: decidePaymentReturnState({
        identifier,
        params,
        ordersBeforeCompletion: [],
        completionAttempted: false,
        ordersAfterCompletion: [],
        completionFailed: false
      })
    };
  }

  if (identifier.kind !== 'cart') {
    return {
      identifier,
      params,
      result: decidePaymentReturnState({
        identifier,
        params,
        ordersBeforeCompletion: [],
        completionAttempted: false,
        ordersAfterCompletion: [],
        completionFailed: false
      })
    };
  }

  // ── 1. ODCZYT ────────────────────────────────────────────────────────────
  let ordersBeforeCompletion: string[] = [];
  try {
    ordersBeforeCompletion = await getCompletedOrderIdsForCart(identifier.value);
  } catch (error) {
    // Odmowa musi być widoczna (NFR-2) — nie połykamy jej po cichu.
    console.warn(`[payment-return] bridge read failed cart=${identifier.value}`, error);
  }

  const alreadyCompleted = ordersBeforeCompletion.length > 0;
  const abandoned = params.redirect_status === 'failed';
  const shouldComplete = !alreadyCompleted && !abandoned;

  // ── 2. DOMKNIĘCIE (tylko gdy jest co domykać) ────────────────────────────
  let ordersAfterCompletion: string[] = [];
  let completionFailed = false;

  if (shouldComplete) {
    const completion = await completeOrderAfterStripePayment(identifier.value);
    if (completion.ok) {
      ordersAfterCompletion = completion.orderIds ?? [];
    } else {
      completionFailed = completion.error?.code === 'completion_failed';
      console.warn(
        `[payment-return] server completion cart=${identifier.value} code=${completion.error?.code ?? 'unknown'}`
      );
    }
  }

  return {
    identifier,
    params,
    result: decidePaymentReturnState({
      identifier,
      params,
      ordersBeforeCompletion,
      completionAttempted: shouldComplete,
      ordersAfterCompletion,
      completionFailed
    })
  };
}
